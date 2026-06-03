# roco-gallery

Static洛克王国图鉴与本地捉宠小页面。

## Local

```bash
npm test
python3 -m http.server 4317 --directory public
```

## Cloudflare

Deploy `public/` as the static assets directory. The included `wrangler.toml`
points Workers assets at `./public` so build-time dependencies such as
`node_modules/` are not uploaded as assets.
