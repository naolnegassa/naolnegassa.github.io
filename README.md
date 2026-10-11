# naolnegassa.github.io

Personal notebook hosted on GitHub Pages. A fine paper texture and progressively
softened curtain shadows give the page its surface. A broad, angled patch of
sunlight follows Addis Ababa (UTC+3), shifting position and colour through the
day, with slow curtain movement and a small footer clock. Light fades back to
neutral paper at night. Reduced-motion settings stop the curtain animation.
Solar calculations run locally using
[NOAA’s approximate solar equations](https://gml.noaa.gov/grad/solcalc/solareqns.PDF).

Serve locally with `python3 -m http.server 4173`, then open
`http://127.0.0.1:4173`. JavaScript modules require an HTTP server.

Run the solar-cycle checks with Node.js 22 or later:

```sh
node --experimental-default-type=module --test tests/*.test.js
```
