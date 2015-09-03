// code-writer-test.ts
///<reference path='../node_modules/immutable/dist/immutable.d.ts'/>
///<reference path='../typings/bluebird/bluebird.d.ts' />
///<reference path='../typings/chai/chai.d.ts'/>
///<reference path='../typings/glob/glob.d.ts'/>
///<reference path='../typings/lodash/lodash.d.ts' />
///<reference path='../typings/mocha/mocha.d.ts'/>
///<reference path='../typings/node/node.d.ts'/>

'use strict';

declare function require(name: string): any;
require('source-map-support').install();

import _ = require('lodash');
import BluePromise = require('bluebird');
import chai = require('chai');
import { ClassesMap } from '../lib/classes-map';
import CodeWriter = require('../lib/code-writer');
import concat = require('concat-stream');
import glob = require('glob');
import Immutable = require('immutable');
import path = require('path');
import stream = require('stream');
import TsJavaOptions = require('../lib/TsJavaOptions');
import TsJavaMain = require('../lib/ts-java-main');

BluePromise.longStackTraces();

interface StreamFunction {
  (data: string): Promise<void>;
}

interface EndFunction {
  (): Promise<void>;
}

describe('CodeWriter', () => {
  var expect = chai.expect;

  var tsJavaMain: TsJavaMain;
  var classesMap: ClassesMap;
  var theWriter: CodeWriter;

  before(() => {
    process.chdir('featureset');
    tsJavaMain = new TsJavaMain(path.join('package.json'));
    return tsJavaMain.load().then((_classesMap: ClassesMap) => {
      classesMap = _classesMap;
      process.chdir('..');
      var templatesDirPath = path.resolve(__dirname, 'templates');
      theWriter = new CodeWriter(classesMap, templatesDirPath);
      return BluePromise.resolve();
    });
  });

  var streamFn: StreamFunction;
  var endFn: EndFunction;
  var resultPromise: Promise<any>;

  beforeEach(() => {
    var memstream: stream.Writable;
    resultPromise = new BluePromise(function (resolve: () => void, reject: (error: any) => void) {
      memstream = concat({}, resolve);
    });
    streamFn = (data: string): Promise<any> => {
      return new BluePromise(function (resolve: () => void, reject: (error: any) => void) {
        memstream.write(data, 'utf8', () => {
          resolve();
        });
      });
    };
    endFn = (): Promise<any> => {
      return new BluePromise(function (resolve: () => void, reject: (error: any) => void) {
        memstream.end();
        resolve();
      });
    };
  });

  describe('initialize', () => {
    it('should initialize', () => {
      expect(theWriter).to.be.ok;
      expect(streamFn).to.be.a('function');
      expect(endFn).to.be.a('function');
    });
    it('should make usable streamFn and endFn', () => {
      var expectedData = 'We write this data.';
      var runPromise = streamFn(expectedData).then(endFn);
      return BluePromise.all([runPromise, resultPromise])
        .spread(function (ignore: any, data: string) {
          expect(data).to.equal(expectedData);
        });
    });
  });

  describe('streamTsJavaModule header', () => {
    it('should write a java.d.ts stream with the expected reference paths', () => {
      var className = 'com.redseal.featureset.SomeAbstractClass';
      var runPromise = theWriter.streamTsJavaModule(tsJavaMain.getOptions(), streamFn, endFn).then(endFn);
      var expectedData = [
        '// tsJavaModule.ts',
        '// This file was generated by ts-java.',
        '/// <reference path=\"../typings/java/java.d.ts\" />',
        '/// <reference path=\"../typings/lodash/lodash.d.ts\" />',
        '/// <reference path=\"../typings/debug/debug.d.ts\" />',
        '',
        'import java = require(\'java\');',
        '// This template intentionally mostly blank',
        ''
      ].join('\n');
      return BluePromise.all([runPromise, resultPromise])
        .spread(function (ignore: any, data: string) {
          expect(data).to.equal(expectedData);
        });
    });
  });
});
