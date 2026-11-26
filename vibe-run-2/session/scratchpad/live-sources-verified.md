# Verified LIVE sources & data (fetched 2026-11-26 ~03:50-04:30 UTC from this host)

## Verified URLs (all HTTP 200 + expected content seen):
1. Destatis Oct 2026 (DE): https://www.destatis.de/DE/Presse/Pressemitteilungen/2026/11/PD26_392_611.html
   - "Verbraucherpreisindex, Oktober 2026: +2,8 % zum Vorjahresmonat (vorläufiges Ergebnis bestätigt) -0,1 % zum Vormonat"
   - Gesamtindex Oct 2026 = 126,5 (2020=100); Sept 2026: +3,3%, Aug 2026: +2,9%
   - KORREKTUR dated 17.11.2026 of PM Nr. 392 vom 11.11.2026. GENESIS tables: 61111-0004 (NOT 61211!)
2. Destatis Nov 2025 (DE): https://www.destatis.de/DE/Presse/Pressemitteilungen/2025/12/PD25_447_611.html
   - Nov 2025 VPI: +2,3% YoY, -0,2% MoM; Gesamtindex Nov 2025 = 122,7 (2020=100)
3. Stadt Zürich postal participation (live, DE): https://www.stadt-zuerich.ch/de/aktuell/news/2026/stimmbeteiligung.html
   - "Die Stimmbeteiligung der brieflichen Stimmabgabe beträgt derzeit 39,6 Prozent." (Urnengang 29.11.2026)
4. gfs.bern 2nd SRG trend survey (DE): https://www.gfsbern.ch/de/news/2-srg-trendumfrage-zur-eidg-abstimmung-vom-29-november-2026/
   - Published 18.11.2026, field 4-11 Nov 2026, n=13,527 (from EN page)
   - Kriegsmaterialgesetz: 49% Ja / 46% Nein (+5 ppt for Nein), "leichtes Ja ... enges Rennen"
   - Teilnahmeabsicht fest: 52% vs langjähriger Durchschnitt 47,3% (2011-2026 BFS)
   - AHV-Zusatzfinanzierung: 46 Ja / 51 Nein; Feuerwerksinitiative: 63/35
5. Electografía (ES, real domain = electografica.com): https://www.electografica.com/2026/11/encuesta-data10-261123.html
   - Data10 tracking 23/11/2026: VOX 19,1% → 64 diputados; PP 33,1+UPN 0,2 (~130-133); PSOE 27,3 (113); FA 6,5 (9); participación 73,2
6. FIDE (EN): https://www.fide.com/new-documents/
   - FACT SHEET – Game 2: White: Gukesh Dommaraju, Black: Javokhir Sindarov, Result ½-½, London System, 20 moves, "Match score: 1–1"
   - "Javokhir Sindarov will have the white pieces for the second time in the match tomorrow, when game three ..." (Sindarov White in G1+G3 → alternation: odd=Sindarov W, even=Gukesh W → Game 8 Gukesh White)
   - Match at Fondation Martin Bodmer, Cologny Geneva, Nov 22 – Dec 12; ratings: Sindarov 2782, Gukesh 2710 (chess.com event page)
7. Wikipedia siteinfo API: https://en.wikipedia.org/w/api.php?action=query&meta=siteinfo&siprop=statistics&format=json
   - articles: 7269403 (Sep 25 initial fetch earlier same day: 7,269,362 per QA)
8. Wikipedia:Size of Wikipedia: https://en.wikipedia.org/wiki/Wikipedia:Size_of_Wikipedia
   - Annual table: 2026-01-01: 7,114,903 (net 2025: 181,607; net/day 2025: 498); row 2026-11-26: 7,269,403 +154,500 net so far (≈469/day)
9. GitHub milestones API: https://api.github.com/repos/golang/go/milestones?state=all...
   - Go1.27.5 milestone = number **457**, open_issues 14, closed_issues 18 (search by TITLE; 305 = Go1.20.4 confirmed)
10. go.dev/doc/devel/release: go1.27.4 (released 2026-11-10); format: <p id="go1.27.4">go1.27.4\n(released 2026-11-10)...
11. GitHub Bun releases API: https://api.github.com/repos/oven-sh/bun/releases?per_page=15
    - bun-v1.4.5 published 2026-11-19T08:47:28Z; v1.4.4 Oct 22, v1.4.3 Oct 10, v1.4.2 Sep 5, v1.4.1 Sep 4, v1.4.0 Aug 20 ...
12. nodejs.org/dist/index.json: 200; latest v27.0.0-alpha.0.1.1 2026-11-16 (n=883 entries)
13. Datatracker ballot page: https://datatracker.ietf.org/doc/draft-ietf-mpls-mna-ioam/ballot/
    - draft-ietf-mpls-mna-ioam-18; IESG evaluation record; Yes: Jim Guichard; all others "No Record";
    - "Needs 9 more YES or NO OBJECTION positions to pass." No DISCUSS recorded.
14. BFS CH CPI Oct 2026 (DE): https://www.admin.ch/de/newnsb/UA8hylpLYO6i
    - LIK Oct 2026: +0,2% MoM, Stand 101,7 Punkte (Dezember 2025 = 100), YoY +1,5% (Sept +1,0%)
15. BFS CH CPI Nov 2025 (DE): https://www.edi.admin.ch/de/newnsb/bgwS3ubvTRAV
    - LIK Nov 2025: -0,2% MoM, Stand 107,0 Punkte (Dezember 2020 = 100), YoY 0,0%
16. BFS CH CPI Dec 2025 (DE): https://statistik.admin.ch/de/news/2026-0005
    - LIK Dec 2025: unverändert, Stand 106,9 Punkte (Dezember 2020 = 100), YoY +0,1%

## Recomputed live math (for refreshers):
- DE CPI Nov 2026 ≥2.8% YoY: required idx ≥ 1.028 × 122,7 = 126.1356; Oct=126.5 → required MoM = -0.288%. Believe YES, high.
- CH CPI Nov 2026 ≥1.6% YoY: idx25.11_new = 107.0×(100/106.9) = 100.133; required idx26.11 ≥ 1.016×100.133 = 101.735; Oct 101.7 → required MoM +0.034%. YES.
- CH turnout: Zurich postal return 39.6% at T-3d + SRG Teilnahmeabsicht 52% (vs 47.3% avg) → YES (≥50% turnout).
- CH war materiel: 49/46 yes with historical late-decisions + AHV co-mobilization nuance → YES-leaning but tight (market 54.9%).
- ES Vox: 19.1% national, 64 seats per own projection, bar is 60 → YES lean (market 48.3%).
- FIDE G8: tie 1-1 after 2 games, Gukesh White in G8 (rating 2710 vs 2782). P(Sindarov strictly ahead after G8) — compute via exact enumeration from Elo gap. (market yes 63.2%)
- Wikipedia: threshold 7,275,500 by Dec 10 12:00; live 7,269,403 → +6,097 needed in ~14 days = 436/day vs live net ~469/day → YES.
- Bun v1.4.6 by Dec 10 (window per market text Nov 28?? check market question) — live gap list needed.
- Go1.27.5: milestone #457: 14 open / 18 closed; go1.27.4 released 2026-11-10. Deadline Dec 7/8. Note: only 18 closed so far.
- IETF: ballot open, 1 YES (Guichard), 13 no record, 0 DISCUSS; needs 9 more yes/no-objection.

## QA finding confirmations:
- PE26_4xx.html → 404 confirmed. worldchampionship2026.fide.com → DNS fail. srg-research.ch → DNS fail. electografia.es → DNS fail. bk.admin.ch postal page → no such page.
- GENESIS table code is 61111-0004 (frozen spec said 61211-0004) — do not cite GENESIS static URL; cite press releases.
- congreso.es/opendata/diputados-loi → 403 (drop from links).
- wikipedia fixture numbers wrong: fixture said 7,271,234 / net 43.7/day; live: 7,269,403 / ~469/day.
- Bun fixture dates wrong (v1.4.5 Nov 24 → live Nov 19; v1.4.3 Nov 1 → live Oct 10).
- go.dev fixture go1.27.4 Nov 12 → live Nov 10.
- FIDE fixture (after game 7, 4.0-3.5) is fiction: live is 1-1 after game 2; game 8 Gukesh White.
