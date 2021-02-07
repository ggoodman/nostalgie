---
title: "Getting Started with Nostalgie"
category: "tutorial"
---

# Getting started with Nostalgie

This tutorial will teach you how to build your first "Hello World" project with Nostalgie.

## Steps

### 1. Scaffolding your project

To scaffold a Nostalgie app, you can use the [create-nostalgie-app](https://npm.im/create-nostalgie-app) module using `npx` (or `npm init`):

```sh
npx create-nostalgie-app my-app
```

Your app will be scaffolded in the `my-app` directory and is ready to go.

You can alternatively provide custom template using the Degit compatible path https://github.com/Rich-Harris/degit#usage:

```sh
npx create-nostalgie-app my-app --template account/repo/path#branch
```

### 2. Run your project in development mode

Running your project in development mode will build your app in development mode and serve it on `http://localhost:8080` (by default). Your app will automatically reload when you change the code.

```sh
# Make sure you're in the directory you just scaffolded
cd my-app
npm run dev
```

Your app will now be started and can be seen at [loalhost:8080](http://localhost:8080).

### 3. Make changes to your app

The main entrypoint to your app is in the `./src/App.tsx` file.

> By default Nostalgie scaffolds a TypesScript project. This file can easily be renamed to `App.jsx` if you prefer to work in JavaScript.

Open `./src/App.tsx` in your editor of choice and make some changes. Make sure that you're still running `npm run dev` from the previous step. You should see log output showing that your project has been rebuilt. If you're watching closely, you should also see that your app has refreshed in the browser, reflecting the changes you made.

### 4. Build your app

Building your app will produce a stand-alone artifact that you can deploy to your hosting provider of choice.

```sh
npm run build
```

A production build of your Nostalgie app is now available in `./build`

## Recap

In this tutorial, you were introduced to `create-nostalgie-app` as an easy way to scaffold a new project. You were also exposed to the common development gestures required to develop and build your Nostalgie App.