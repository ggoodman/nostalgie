#!/usr/bin/env node

'use strict';

/**
 * Copyright (c) 2015-present, Facebook, Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root of https://github.com/facebook/create-react-app
 *
 * With modifications by: Geoff Goodman
 */

var currentNodeVersion = process.versions.node;
var semver = currentNodeVersion.split('.');
var major = semver[0];

if (major < 12) {
  console.error(
    'You are running Node ' +
      currentNodeVersion +
      '.\n' +
      'Create Nostalgie App requires Node 12 or higher. \n' +
      'Please update your version of Node.'
  );
  process.exit(1);
}

const { init } = require('./createNostalgieApp');

init();
