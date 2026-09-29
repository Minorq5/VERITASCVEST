# Bulgarian fallback fonts

`vt-onest-bg.woff2` and `vt-jetbrains-bg.woff2` are modified subsets of
Onest and JetBrains Mono (both SIL Open Font License 1.1, see `OFL.txt`).
They add only the Bulgarian letters ѝ / Ѝ, composed from each font's own
и / И and combining grave accent. They are renamed ("VT Onest BG",
"VT JetBrains BG") as the OFL requires for modified versions.

Rebuild: `python3 scripts/fonts/build_bg_fallback.py <dir-with-source-ttfs> src/assets/fonts`
