# naolnegassa.github.io

Personal notebook hosted on GitHub Pages. The page’s light follows Addis Ababa
(UTC+3), with seasonal sunrise/sunset estimates, a quiet nighttime lamp, and a
small footer clock. Light follows the current time automatically. Solar calculations run locally using
[NOAA’s approximate solar equations](https://gml.noaa.gov/grad/solcalc/solareqns.PDF).

Serve locally with `python3 -m http.server 4173`, then open
`http://127.0.0.1:4173`. JavaScript modules require an HTTP server.

Run the solar-cycle and renderer checks with Node.js 22 or later:

```sh
node --experimental-default-type=module --test tests/*.test.js
```
