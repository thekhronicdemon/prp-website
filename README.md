# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

## Twitch Live Status

The Streamers page checks live/offline status through a Supabase Edge Function so
the Twitch client secret is not exposed on GitHub Pages.

Set the Twitch credentials as Supabase secrets:

```sh
supabase secrets set TWITCH_CLIENT_ID=your_client_id TWITCH_CLIENT_SECRET=your_client_secret
```

Deploy the function:

```sh
supabase functions deploy twitch-streams
```

The React app will call:

```txt
VITE_SUPABASE_URL/functions/v1/twitch-streams?users=stonedninja
```

You can override that endpoint with `VITE_TWITCH_PROXY_URL` if you host your own
proxy. Do not put `TWITCH_CLIENT_SECRET` in a `VITE_` environment variable.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.
