# Data files

`visa.json` holds entry requirements for every passport and destination, from the Passport Index data
(passportindex.org) as published at https://github.com/imorte/passport-index-data under the MIT licence
(last updated 17 February 2026). Each passport's row lists destinations in the order of `codes`:
a number is visa-free days, `f` visa free, `a` visa on arrival, `t` electronic travel authorisation,
`e` e-visa, `v` visa required, `x` no admission, `-` own country.

To refresh it, download `passport-index-tidy-iso2.csv` from that repository and re-run the conversion
in `apps/api/scripts/visa-data.py`, then change `updated` to the repository's date.
