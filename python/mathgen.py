#!/usr/bin/env python3
"""mathgen.py — local math + CSV generator for Delphi evidence mining.

Usage:
    python3 python/mathgen.py analyze --spec <spec.json> --csv <out.csv>

Reads {kind, params, meta} from --spec, writes a compact CSV of the underlying
series/derivation to --csv, and prints one JSON object to stdout:

    {"kind": ..., "evidenceImpliedYes": p, "confidence": ...,
     "methodLines": [...], "figureSummary": "..."}

Pure stdlib. Deterministic. No network.
"""

import argparse
import csv
import datetime as dt
import json
import math
import sys
from statistics import NormalDist

N = NormalDist()


def mean(xs):
    return sum(xs) / len(xs)


def sd(xs):
    if len(xs) < 2:
        return 0.0
    m = mean(xs)
    return math.sqrt(sum((x - m) ** 2 for x in xs) / (len(xs) - 1))


def p_above(x, mu, s):
    """P(X >= x) for X ~ N(mu, s); never exactly 0/1, floored for honesty."""
    if s <= 0:
        return 1e-6 if x > mu else 0.999999
    p = 1 - N.cdf((x - mu) / s)
    return min(max(p, 1e-6), 0.999999)


def fmt(x, d=2):
    return f"{x:.{d}f}"


# ---------------------------------------------------------------- kinds


def cpi_base_effect(p):
    """Base-effect arithmetic on an official index.
    Required target-month MoM to hit the YoY threshold, vs the target month's
    historical seasonal MoM distribution (normal + empirical, blended)."""
    series = p["series"]  # [[ym, index], ...] ends at last known month
    threshold = p["targetThresholdPct"]  # YoY % threshold
    seasonal = p["seasonalMomPct"]  # target-month MoM, last 10 years
    idx_last_ym, idx_last = series[-1][0], float(series[-1][1])
    ym_ya, idx_ya = p["yearAgoYm"], p["yearAgoIndex"]

    def yoy(x_month):
        return ((1 + x_month / 100.0) * idx_last / idx_ya - 1) * 100.0

    required_mom = ((1 + threshold / 100.0) * idx_ya / idx_last - 1) * 100.0
    m, s = mean(seasonal), max(sd(seasonal), 0.06)
    p_norm = p_above(required_mom, m, s)
    p_emp = sum(1 for x in seasonal if x >= required_mom) / len(seasonal)
    p_yes = (p_norm + p_emp) / 2.0
    implied_at_mean = yoy(m)

    rows = [["row_type", "month_or_scenario", "index", "mom_pct", "yoy_pct"]]
    by_ym = {ym: float(idx) for ym, idx in series}
    prev = None
    for ym, idx in series:
        idx = float(idx)
        mom = "" if prev is None else (idx / prev - 1) * 100
        ya_ym = None
        if len(ym) == 7:
            y, mth = ym.split("-")
            ya_ym = f"{int(y) - 1}-{mth}"
        yoy = (idx / by_ym[ya_ym] - 1) * 100 if ya_ym in by_ym else ""
        rows.append(["series", ym, fmt(idx, 1), "" if mom == "" else fmt(mom), "" if yoy == "" else fmt(yoy)])
        prev = idx
    rows.append(["scenario", f"required_mom_for_yoy>={threshold}", "", fmt(required_mom), fmt(threshold)])
    rows.append(["scenario", "implied_yoy_at_10y_mean_mom", "", fmt(m), fmt(implied_at_mean)])
    for x in seasonal:
        rows.append(["seasonal", "target_month_mom_10y", "", fmt(x), ""])
    method = [
        f"YoY identity: (1 + MoM) x {idx_last_ym} index / {ym_ya} index - 1.",
        f"Required {p.get('targetMonth')} MoM to reach YoY {threshold}%: "
        f"(1+{threshold/100:.3f}) x {idx_ya} / {idx_last} - 1 = {'+' if required_mom>=0 else ''}{required_mom:.3f}%.",
        f"10-year {p.get('targetMonth')} MoM: mean {'+' if m>=0 else ''}{m:.3f}% (sd {s:.3f}%); "
        f"implied YoY at the mean: {implied_at_mean:.2f}%.",
        f"P(MoM >= required) = normal {p_norm:.3f}, empirical {p_emp:.2f}; blended evidence-implied P(yes) = {p_yes:.3f}.",
    ]
    summary = (
        f"required MoM {'+' if required_mom>=0 else ''}{required_mom:.2f}% vs seasonal mean "
        f"{'+' if m>=0 else ''}{m:.2f}% => P(yes) ~ {p_yes:.0%}"
    )
    conf = "high" if abs(p_yes - 0.5) > 0.3 else "medium"
    return p_yes, conf, method, summary, rows


def turnout_projection(p):
    """OLS: final turnout ~ postal return rate at T-8d on prior federal votes."""
    hist = p["history"]  # [{vote, returnT8, final}]
    cur, thr = p["currentReturnT8"], p["thresholdPct"]
    xs = [h["returnT8"] for h in hist]
    ys = [h["final"] for h in hist]
    n = len(xs)
    mx, my = mean(xs), mean(ys)
    sxx = sum((x - mx) ** 2 for x in xs)
    sxy = sum((x - mx) * (y - my) for x, y in zip(xs, ys))
    b = sxy / sxx
    a = my - b * mx
    resid = [y - (a + b * x) for x, y in zip(xs, ys)]
    s_res = math.sqrt(sum(r * r for r in resid) / (n - 2))
    se_pred = s_res * math.sqrt(1 + 1 / n + (cur - mx) ** 2 / sxx)
    pred = a + b * cur
    p_yes = p_above(thr, pred, se_pred)
    rows = [["row_type", "vote", "return_T8_pct", "final_turnout_pct", "ols_fit_pct", "residual"]]
    for h, x, y, f, r in zip(hist, xs, ys, [a + b * x for x in xs], resid):
        rows.append(["history", h["vote"], fmt(x, 1), fmt(y, 1), fmt(f, 1), fmt(r, 1)])
    rows.append(["current", p["currentVote"], fmt(cur, 1), fmt(pred, 1), fmt(pred, 1), ""])
    method = [
        f"OLS on {n} prior federal votes: final = {a:.2f} + {b:.3f} x (T-8d postal return).",
        f"Current weighted T-8d return {cur:.1f}% => predicted final turnout {pred:.2f}% "
        f"(prediction sd {se_pred:.2f}pp).",
        f"P(turnout >= {thr:.1f}%) = {p_yes:.3f}.",
    ]
    summary = f"predicted turnout {pred:.1f}% vs {thr:.0f}% bar => P(yes) ~ {p_yes:.0%}"
    return p_yes, "medium", method, summary, rows


def poll_margin_regression(p):
    """OLS: final yes-share ~ -8d poll yes-share on prior federal votes."""
    hist, cur, thr = p["history"], p["currentPollYesPct"], p["thresholdPct"]
    xs = [h["pollYesPct"] for h in hist]
    ys = [h["finalYesPct"] for h in hist]
    n = len(xs)
    mx, my = mean(xs), mean(ys)
    sxx = sum((x - mx) ** 2 for x in xs)
    sxy = sum((x - mx) * (y - my) for x, y in zip(xs, ys))
    b = sxy / sxx
    a = my - b * mx
    resid = [y - (a + b * x) for x, y in zip(xs, ys)]
    s_res = math.sqrt(sum(r * r for r in resid) / (n - 2))
    se_pred = s_res * math.sqrt(1 + 1 / n + (cur - mx) ** 2 / sxx)
    pred = a + b * cur
    p_yes = p_above(thr, pred, se_pred)
    rows = [["row_type", "vote", "poll_minus8d_yes_pct", "final_yes_pct", "ols_fit", "residual"]]
    for h, x, y, f, r in zip(hist, xs, ys, [a + b * x for x in xs], resid):
        rows.append(["history", h["vote"], fmt(x, 1), fmt(y, 1), fmt(f, 1), fmt(r, 1)])
    rows.append(["current", p["currentVote"], fmt(cur, 1), fmt(pred, 1), fmt(pred, 1), ""])
    method = [
        f"OLS on {n} prior federal votes: final yes = {a:.2f} + {b:.3f} x poll-yes(-8d).",
        f"Current weighted poll-yes {cur:.1f}% => predicted final {pred:.2f}% (sd {se_pred:.2f}pp).",
        f"P(final >= {thr:.1f}%) = {p_yes:.3f}.",
    ]
    summary = f"predicted final yes {pred:.1f}% vs {thr:.0f}% bar => P(yes) ~ {p_yes:.0%}"
    return p_yes, "medium", method, summary, rows


def dhondt_seats(p):
    """D'Hondt provincial seat allocation from polls, aggregated against the bar."""
    party, thr = p["party"], p["thresholdSeats"]
    explicit = []
    total = 0
    rows = [["district", "seats", "party_vote_shares_used", f"{party}_seats_allocated"]]
    for d in p["districts"]:
        seats = d["seats"]
        shares = {k: float(v) for k, v in d["parties"].items()}
        allocated = {k: 0 for k in shares}
        for _ in range(seats):
            best = max(shares, key=lambda k: shares[k] / (allocated[k] + 1))
            allocated[best] += 1
        v = allocated.get(party, 0)
        explicit.append(v)
        total += v
        rows.append([d["name"], str(seats), json.dumps(shares), str(v)])
    rem = p["remainder"]
    rem_mean = (rem["low"] + rem["high"]) / 2
    rem_sd = max((rem["high"] - rem["low"]) / 4, 1.5)
    combined_mean = total + rem_mean
    combined_sd = rem_sd
    p_yes = p_above(thr, combined_mean, combined_sd)
    rows.append([f"remainder ({rem['label']})", str(rem["seats"]), f"range {rem['low']}-{rem['high']}", fmt(rem_mean, 1)])
    rows.append(["TOTAL projected", "350", "", fmt(combined_mean, 1)])
    method = [
        f"Ran D'Hondt per province on the polled shares for {len(p['districts'])} explicit districts "
        f"({sum(d['seats'] for d in p['districts'])} of 350 seats): {party} = {total}.",
        f"Remainder ({rem['label']}, {rem['seats']} seats) from the same poll vendor's "
        f"smaller-province estimates: {rem['low']}-{rem['high']}, midpoint {rem_mean:.0f}.",
        f"Projected total {party}: {combined_mean:.1f} seats (sd {combined_sd:.1f}); P(>= {thr}) = {p_yes:.3f}.",
    ]
    summary = f"projected {party} seats ~{combined_mean:.0f} vs {thr} bar => P(yes) ~ {p_yes:.0%}"
    return p_yes, "medium", method, summary, rows


def ballot_flag_snapshot(p):
    """P(DISCUSS by cutoff): comparable-draft base rate attenuated by the share
    of IESG positions still unrecorded (live ballot state)."""
    with_d = p["withDiscuss"]
    n_sim = p["similarDrafts"]
    p_discuss = with_d / n_sim
    recorded = p.get("positionsRecorded", 0)
    total = p.get("positionsTotal", n_sim)
    remaining_fraction = max((total - recorded) / total, 0.0)
    p_yes = p_discuss * remaining_fraction
    rows = [["row_type", "metric", "value"]]
    for k, v in [
        ("doc", p["doc"]),
        ("positions recorded (live)", str(recorded)),
        ("IESG positions total", str(total)),
        ("needed to pass (live)", str(p.get("neededToPass", ""))),
        ("DISCUSS count (live)", str(p.get("discussCount", 0))),
        (f"comparable drafts with >=1 DISCUSS (assumption)", f"{with_d}/{n_sim}"),
        ("P(any DISCUSS by cutoff)", fmt(p_yes, 3)),
    ]:
        rows.append(["live" if "(live)" in k else "assumption" if "assumption" in k else "scenario", k, v])
    method = [
        f"Live Datatracker ballot snapshot for {p['doc']}: {p.get('ballotStateText', 'ballot state recorded')}.",
        f"Comparable-draft base rate (stated assumption): {with_d}/{n_sim} similar drafts drew >=1 DISCUSS.",
        f"Atteuation by unrecorded positions: p = {p_discuss:.2f} x ({total}-{recorded})/{total} = {p_yes:.3f}.",
    ]
    summary = f"base rate {p_discuss:.0%} x unrecorded share => P(yes) ~ {p_yes:.0%}"
    return p_yes, "medium", method, summary, rows


def markov_lead(p):
    """Score-lead Markov update over the games remaining before the cutoff."""
    diff = p["leaderPoints"] - p["trailerPoints"]
    games = p["games"]  # [{drawProb, winProb, lossProb}] for each remaining game
    # State distribution over possible diffs.
    dist = {round(diff, 2): 1.0}
    for g in games:
        nxt = {}
        for d, pr in dist.items():
            for delta, gp in ((1.0, g["winProb"]), (0.0, g["drawProb"]), (-1.0, g["lossProb"])):
                nxt[round(d + delta, 2)] = nxt.get(round(d + delta, 2), 0.0) + pr * gp
        dist = nxt
    p_yes = sum(pr for d, pr in dist.items() if d > 0.0)
    rows = [["game_index", "leader_color", "win_prob", "draw_prob", "loss_prob"]]
    for i, g in enumerate(games, 1):
        rows.append([str(i), g.get("leaderColor", ""), fmt(g["winProb"], 3), fmt(g["drawProb"], 3), fmt(g["lossProb"], 3)])
    rows.append([f"lead before game {p['asOfGame'] + 1}", "", "", fmt(diff, 1), ""])
    rows.append(["P(leader strictly ahead after listed games)", "", "", "", fmt(p_yes, 3)])
    method = [
        f"Standings after game {p['asOfGame']}: {p['leader']} {p['leaderPoints']} - "
        f"{p['trailer']} {p['trailerPoints']}; lead {diff:.1f} points; "
        f"{len(games)} game(s) before the market's evaluation point.",
        f"Outcome distribution for game 8 ({p['leader']} White per FIDE color allocation): "
        f"win {games[0]['winProb']:.2f}, draw {games[0]['drawProb']:.2f}, loss {games[0]['lossProb']:.2f} "
        f"(based on {p['historicalBasis']}).",
        "Strictly-more-points after game 8 fails only if the leader loses game 8 "
        f"(a loss levels the score, which is not 'strictly more'): P = {p_yes:.3f}.",
    ]
    summary = f"P(not losing game 8 as White) = {p_yes:.0%}"
    return p_yes, "high", method, summary, rows


def threshold_velocity(p):
    """Net-velocity projection against a fixed threshold at a fixed date."""
    cur, target = p["currentCount"], p["targetCount"]
    days, dm, ds = p["daysRemaining"], p["dailyNetMean"], p["dailyNetSd"]
    vel = p["velocity"]  # {label, days, net} — observed window, live-computed
    required = target - cur
    needed_daily = required / days
    proj_mean = dm * days
    proj_sd = ds * math.sqrt(days)
    p_yes = p_above(required, proj_mean, proj_sd)
    rows = [["row_type", "metric", "value"]]
    for k, v in [
        ("current count (live snapshot)", cur),
        ("threshold", target),
        ("required net gain", required),
        ("days remaining to evaluation", fmt(days, 2)),
        ("required net per day", fmt(needed_daily, 1)),
        (f"observed net per day ({vel['label']}, live)", fmt(vel["net"] / vel["days"], 1)),
        ("daily net sd (stated assumption)", fmt(ds, 1)),
        ("projected net over remaining days", fmt(proj_mean, 0)),
        ("projection sd", fmt(proj_sd, 0)),
        ("P(net >= required)", fmt(p_yes, 6)),
    ]:
        rows.append(["live" if isinstance(v, (int, float)) or "live" in k else "scenario", k, v])
    method = [
        f"Required net gain {required:,} over {days:.1f} days = {needed_daily:.1f}/day.",
        f"Observed net velocity ({vel['label']}, live): {vel['net']:,} net over {vel['days']} days "
        f"= {vel['net'] / vel['days']:.1f}/day.",
        f"Projection N({proj_mean:.0f}, {proj_sd:.0f}): P(>= {required:,}) = {p_yes:.6f} "
        f"(z = {(required - proj_mean) / proj_sd:.1f}).",
    ]
    summary = f"needs {needed_daily:.0f}/day vs observed ~{dm:.0f}/day => P(yes) ~ {p_yes:.4f}"
    return p_yes, "high", method, summary, rows


def release_gap_cdf(p):
    """Empirical release-gap distribution vs the market window."""
    rel = sorted(p["releases"], key=lambda r: r["date"])
    dates = [dt.date.fromisoformat(r["date"]) for r in rel]
    gaps = [(dates[i + 1] - dates[i]).days for i in range(len(dates) - 1)]
    last = dates[-1]
    w_start = dt.date.fromisoformat(p["windowStart"])
    w_end = dt.date.fromisoformat(p["windowEnd"])
    # A release lands in the window if gap g satisfies last+g in [start, end].
    hit = sum(1 for g in gaps if w_start <= last + dt.timedelta(days=g) <= w_end)
    p_yes = hit / len(gaps)
    rows = [["tag", "published_at", "gap_days_to_next"]]
    for i, r in enumerate(rel):
        rows.append([r["tag"], r["date"], str(gaps[i]) if i < len(gaps) else ""])
    rows.append(["last release before window", str(last), ""])
    rows.append([f"market window [{p['windowStart']}..{p['windowEnd']}]", "", ""])
    rows.append([f"historical gaps landing inside window", f"{hit}/{len(gaps)}", ""])
    rows.append([f"P(next release in window), empirical", fmt(p_yes, 3), ""])
    method = [
        f"Last {len(gaps) + 1} release dates (fetched live): mean gap {mean(gaps):.1f} days, "
        f"median {sorted(gaps)[len(gaps)//2]} days, max {max(gaps)} days.",
        f"Window {p['windowStart']}..{p['windowEnd']} given last release {last.isoformat()}.",
        f"Empirical: {hit}/{len(gaps)} historical gaps fall in the window => P ~ {p_yes:.2f}.",
    ]
    summary = f"{hit}/{len(gaps)} historical gaps fit the window => P(yes) ~ {p_yes:.0%}"
    return p_yes, "high", method, summary, rows


def blocker_clearance(p):
    """Milestone blocker clearance rate vs deadline window."""
    open_b, deadline = p["openBlockers"], p["deadlineDays"]
    comps = p["comparables"]  # [{version, openAtSnapshot, daysToListing}]
    rates = [c["openAtSnapshot"] / c["daysToListing"] for c in comps]
    durations = [open_b / r for r in rates]
    mu = mean(durations)
    s = max(sd(durations), p.get("sdFloorDays", 3.0))
    p_yes = p_above(deadline, mu, s)
    rows = [["version", "listed_at", "open_at_-Nd_snapshot", "days_snapshot_to_listing", "clearance_per_day"]]
    for c, r in zip(comps, rates):
        rows.append([c["version"], c["listedAt"], str(c["openAtSnapshot"]), str(c["daysToListing"]), fmt(r, 2)])
    rows.append([f"Go1.27.5 (current, {open_b} open)", "", "", fmt(mu, 1), fmt(mean(rates), 2)])
    rows.append(["deadline days from snapshot", "", "", fmt(deadline, 1), ""])
    rows.append(["P(listed by deadline)", "", "", fmt(p_yes, 3), ""])
    method = [
        f"Go1.27.5 milestone: {open_b} open blockers (GitHub API snapshot).",
        f"Comparable minors: "
        + "; ".join(f"{c['version']} {c['openAtSnapshot']} blockers/{c['daysToListing']}d "
                    f"({c['openAtSnapshot']/c['daysToListing']:.2f}/day)" for c in comps)
        + ".",
        f"Predicted snapshot-to-listing duration for {open_b} blockers: {mu:.1f} days "
        f"(sd {s:.1f}, floored) vs {deadline:.1f} days to the Dec 8 deadline.",
        f"P(listed by deadline) = {p_yes:.3f}. Minor cadence is 28 days (1.27.1-1.27.4, already overdue), "
        "but the blocker queue, not the cadence, gates the tag.",
    ]
    summary = f"predicted {mu:.0f}d to list vs {deadline:.0f}d left => P(yes) ~ {p_yes:.0%}"
    return p_yes, "medium", method, summary, rows


def cpi_required_mom(p):
    """Required target-month MoM to clear a YoY threshold, from two live index
    levels. Seasonal MoM distribution is a stated model assumption."""
    thr = p["targetThresholdPct"]
    idx_ya, idx_last = p["yearAgoIndex"], p["latestIndex"]
    seasonal = p["seasonalMomPct"]
    required_mom = ((1 + thr / 100.0) * idx_ya / idx_last - 1) * 100.0
    m, s = mean(seasonal), max(sd(seasonal), 0.06)
    p_norm = p_above(required_mom, m, s)
    p_emp = sum(1 for x in seasonal if x >= required_mom) / len(seasonal)
    p_yes = (p_norm + p_emp) / 2.0
    implied_yoy_at_mean = ((1 + m / 100.0) * idx_last / idx_ya - 1) * 100.0
    rows = [["row_type", "item", "value_1", "value_2"]]
    rows.append(["live_index", p.get("yearAgoYm"), fmt(idx_ya, 1), ""])
    rows.append(["live_index", p.get("latestYm"), fmt(idx_last, 1), fmt(p.get("latestYoYPct", ""), 1)])
    rows.append(["scenario", f"required_mom_for_yoy>={thr}", fmt(required_mom), f"target_yoy={thr}"])
    rows.append(["scenario", "implied_yoy_at_assumed_mean_mom", "+" if m >= 0 else "" + fmt(m), fmt(implied_yoy_at_mean)])
    for x in seasonal:
        rows.append(["assumption", "target_month_mom_10y", fmt(x), ""])
    method = [
        f"YoY identity: Nov YoY = (1 + MoM) x {p.get('latestYm')} index ({idx_last}) / "
        f"{p.get('yearAgoYm')} index ({idx_ya}) - 1 (both index levels fetched live, base {p.get('base')}).",
        f"Required MoM to reach YoY >= {thr}%: (1+{thr/100:.4f}) x {idx_ya} / {idx_last} - 1 = "
        f"{'+' if required_mom >= 0 else ''}{required_mom:.3f}%.",
        f"10y target-month MoM (stated assumption): mean {'+' if m >= 0 else ''}{m:.2f}% (sd {s:.2f}%); "
        f"YoY at the mean MoM: {implied_yoy_at_mean:.2f}%.",
        f"P(MoM >= required) = normal {p_norm:.3f}, empirical {p_emp:.2f}; blended P(yes) = {p_yes:.3f}.",
    ]
    summary = (f"required MoM {'+' if required_mom >= 0 else ''}{required_mom:.2f}% vs assumed seasonal mean "
               f"{'+' if m >= 0 else ''}{m:.2f}% => P(yes) ~ {p_yes:.0%}")
    conf = "high" if abs(p_yes - 0.5) > 0.3 else "medium"
    return p_yes, conf, method, summary, rows


def turnout_threshold(p):
    """Final-turnout threshold check from live early-return and survey figures.
    The intention-to-final offset is a stated model assumption."""
    thr = p["thresholdPct"]
    intention = p["participationIntentionPct"]
    avg_intention = p["longTermAvgIntentionPct"]
    final_expect = p["expectedFinalPct"]
    s = p["sdPct"]
    p_yes = p_above(thr, final_expect, s)
    rows = [["row_type", "item", "value_pct"]]
    rows.append(["live", p.get("returnSourceLabel"), fmt(p["earlyReturnPct"], 1)])
    rows.append(["live", f"participation intention ({p.get('intentionSourceLabel')})", fmt(intention, 1)])
    rows.append(["live", "long-term average participation intention", fmt(avg_intention, 1)])
    rows.append(["scenario", "expected final turnout (stated offset)", fmt(final_expect, 1)])
    rows.append(["scenario", f"P(final >= {thr})", fmt(p_yes, 3)])
    method = [
        f"Live: {p.get('returnSourceLabel')} shows {p['earlyReturnPct']:.1f}% postal returns at {p.get('stage')}.",
        f"Live: participation intention {intention:.1f}% vs long-term average {avg_intention:.1f}% "
        f"({p.get('intentionSourceLabel')}).",
        f"Model (stated assumption): expected final turnout {final_expect:.1f}% (sd {s:.1f}pp).",
        f"P(final turnout >= {thr:.1f}%) = {p_yes:.3f}.",
    ]
    summary = f"expected final {final_expect:.1f}% vs {thr:.0f}% bar => P(yes) ~ {p_yes:.0%}"
    return p_yes, "medium", method, summary, rows


def seat_threshold(p):
    """P(party seats >= threshold) around a live projected seat count."""
    est, thr = p["sourceSeatEstimate"], p["thresholdSeats"]
    s = p["estimateSd"]
    p_yes = p_above(thr, est, s)
    rows = [["row_type", "item", "value"]]
    rows.append(["live", "projected seats", str(est)])
    rows.append(["scenario", "threshold", str(thr)])
    rows.append(["scenario", "estimate sd (assumption)", fmt(s, 1)])
    rows.append(["scenario", "P(seats >= threshold)", fmt(p_yes, 3)])
    method = [
        f"Live projection ({p.get('source')}): {p['party']} = {est} seats vs the {thr}-seat bar.",
        f"Model (stated assumption): projection error sd {s:.1f} seats.",
        f"P(seats >= {thr}) = {p_yes:.3f}.",
    ]
    summary = f"projected {est} vs {thr} bar => P(yes) ~ {p_yes:.0%}"
    conf = "high" if abs(p_yes - 0.5) > 0.3 else "medium"
    return p_yes, conf, method, summary, rows


def match_lead_elo(p):
    """P(side A strictly ahead after N more games) from the live match score,
    live Elo ratings and a stated draw-share assumption, by exact enumeration."""
    score_a, score_b = p["scoreA"], p["scoreB"]
    elo_a, elo_b = p["eloA"], p["eloB"]
    n_games = p["gamesRemaining"]
    d = p["drawShare"]
    expected_a = 1.0 / (1.0 + 10 ** (-(elo_a - elo_b) / 400.0))
    edge = 2 * expected_a - 1  # win minus loss probability
    w = (1 - d + edge) / 2.0
    l = (1 - d - edge) / 2.0
    if l < 0 or w > 1:
        raise ValueError("drawShare assumption inconsistent with Elo edge")
    # exact distribution of the lead delta after n games
    dist = {round(score_a - score_b, 2): 1.0}
    for _ in range(n_games):
        nxt = {}
        for delta, pr in dist.items():
            for dd, gp in ((1.0, w), (0.0, d), (-1.0, l)):
                k = round(delta + dd, 2)
                nxt[k] = nxt.get(k, 0.0) + pr * gp
        dist = nxt
    p_yes = sum(pr for delta, pr in dist.items() if delta > 0)
    rows = [["row_type", "item", "value"]]
    rows.append(["live", f"{p['nameA']} score", fmt(score_a, 1)])
    rows.append(["live", f"{p['nameB']} score", fmt(score_b, 1)])
    rows.append(["live", f"{p['nameA']} Elo", str(elo_a)])
    rows.append(["live", f"{p['nameB']} Elo", str(elo_b)])
    rows.append(["model", "Elo expected score", fmt(expected_a, 4)])
    rows.append(["model", "per-game win/draw/loss for " + p["nameA"], f"{w:.3f}/{d:.3f}/{l:.3f}"])
    rows.append(["scenario", "games remaining to market evaluation", str(n_games)])
    rows.append(["scenario", f"P({p['nameA']} strictly ahead)", fmt(p_yes, 3)])
    method = [
        f"Live: match score {p['nameA']} {score_a} - {score_b} {p['nameB']} "
        f"({p.get('scoreSource')}); Elo {elo_a} vs {elo_b} ({p.get('eloSource')}).",
        f"Elo expected score for {p['nameA']}: {expected_a:.4f} per game.",
        f"Model (stated assumption): draw share {d:.0%} => per-game W/D/L = "
        f"{w:.3f}/{d:.3f}/{l:.3f} (color-averaged).",
        f"Exact enumeration over {n_games} remaining games: P(strictly ahead) = {p_yes:.3f}.",
    ]
    summary = f"enum over {n_games} games: P(ahead) ~ {p_yes:.0%}"
    conf = "medium"
    return p_yes, conf, method, summary, rows


KINDS = {
    "cpi_base_effect": cpi_base_effect,
    "cpi_required_mom": cpi_required_mom,
    "turnout_projection": turnout_projection,
    "turnout_threshold": turnout_threshold,
    "poll_margin_regression": poll_margin_regression,
    "dhondt_seats": dhondt_seats,
    "seat_threshold": seat_threshold,
    "ballot_flag_snapshot": ballot_flag_snapshot,
    "markov_lead": markov_lead,
    "match_lead_elo": match_lead_elo,
    "threshold_velocity": threshold_velocity,
    "release_gap_cdf": release_gap_cdf,
    "blocker_clearance": blocker_clearance,
}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("cmd", choices=["analyze"])
    ap.add_argument("--spec", required=True)
    ap.add_argument("--csv", required=True)
    args = ap.parse_args()
    with open(args.spec, encoding="utf-8") as f:
        spec = json.load(f)
    kind = spec["kind"]
    params = spec["params"]
    fn = KINDS[kind]
    p_yes, conf, method, summary, rows = fn(params)
    meta = spec.get("meta", {})
    sources = meta.get("sources", [])
    if sources:
        width = len(rows[0])
        for s_ in sources:
            src_row = ["source", s_.get("url", ""), s_.get("fetchedAt", "")]
            rows.append(src_row + [""] * (width - len(src_row)))
    with open(args.csv, "w", newline="", encoding="utf-8") as f:
        csv.writer(f).writerows(rows)
    print(json.dumps({
        "kind": kind,
        "evidenceImpliedYes": round(p_yes, 4),
        "confidence": conf,
        "methodLines": method,
        "figureSummary": summary,
    }))


if __name__ == "__main__":
    main()
