/*
 *  Copyright (c) 2015-2017, Michael A. Updike All rights reserved.
 *
 *  Redistribution and use in source and binary forms, with or without
 *  modification, are permitted provided that the following conditions are met:
 *
 *  Redistributions of source code must retain the above copyright notice,
 *  this list of conditions and the following disclaimer.
 *
 *  Redistributions in binary form must reproduce the above copyright notice,
 *  this list of conditions and the following disclaimer in the documentation
 *  and/or other materials provided with the distribution.
 *
 *  Neither the name of the copyright holder nor the names of its contributors
 *  may be used to endorse or promote products derived from this software
 *  without specific prior written permission.
 *
 *  THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
 *  AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO,
 *  THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR
 *  PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR
 *  CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL,
 *  EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO,
 *  PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS;
 *  OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY,
 *  WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR
 *  OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE,
 *  EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */
'use strict';

// paths and files
const base = {
	src: 'app/',
	dist: 'dist/app/',
	dev: 'dev/app/',
	store: 'store/',
};
const path = {
	scripts: {
		src: base.src + 'scripts/',
		dist: base.dist + 'scripts/',
		dev: base.dev + 'scripts/',
	},
	html: {
		src: base.src + 'html/',
		dist: base.dist + 'html/',
		dev: base.dev + 'html/',
	},
	elements: {
		src: base.src + 'elements/',
		dist: base.dist + 'elements/',
		dev: base.dev + 'elements/',
	},
	styles: {
		src: base.src + 'styles/',
		dist: base.dist + 'styles/',
		dev: base.dev + 'styles/',
	},
	images: {
		src: base.src + 'images/',
		dist: base.dist + 'images/',
		dev: base.dev + 'images/',
	},
	assets: {
		src: base.src + 'assets/',
		dist: base.dist + 'assets/',
		dev: base.dev + 'assets/',
	},
	lib: {
		src: base.src + 'lib/',
		dist: base.dist + 'lib/',
		dev: base.dev + 'lib/',
	},
	bower: {
		src: base.src + 'bower_components/',
		dist: base.dist + 'bower_components/',
		dev: base.dev + 'bower_components/',
	},
};

const files = {
	manifest: base.src + 'manifest.json',
	scripts: path.scripts.src + '*.*',
	html: path.html.src + '*.*',
	styles: path.styles.src + '**/*.*',
	elements: path.elements.src + '**/*.*',
	images: path.images.src + '*.*',
	assets: path.assets.src + '*.*',
	lib: path.lib.src + '*.*',
	bower: [
		path.bower.src + '**/*',
		'!' + path.bower.src + '**/test/*',
		'!' + path.bower.src + '**/demo/*',
	],
};

// flag for production release build
let isProd = false;
// flag to keep key in production build for testing purposes
let isProdTest = false;

const gulp = require('gulp');
const del = require('del');
const runSequence = require('run-sequence');
const gutil = require('gulp-util');

// load the rest
const plugins = require('gulp-load-plugins')({
	pattern: ['gulp-*', 'gulp.*'],
	replaceString: /\bgulp[\-.]/,
});

/**
 * print which file changed
 * @param {event} event - the event
 */
function onChange(event) {
	gutil.log('File', gutil.colors.cyan(event.path.replace(/.*(?=app)/i, '')),
		'was', gutil.colors.magenta(event.type));
}

// Default - watch for changes in development
gulp.task('default', ['watch']);

// Development build
gulp.task('dev', function(callback) {
	isProd = false;

	runSequence('clean', ['bower', 'manifest', 'html', 'scripts', 'styles',
		'elements', 'images', 'assets', 'lib'], callback);
});

// Production build
gulp.task('prod', function(callback) {
	isProd = true;
	isProdTest = false;

	runSequence('clean', ['manifest', 'html', 'scripts', 'styles', 'vulcanize',
		'images', 'assets', 'lib'], 'zip', callback);
});

// Production test build
gulp.task('prodTest', function(callback) {
	isProd = true;
	isProdTest = true;

	runSequence('clean', ['manifest', 'html', 'scripts', 'styles', 'vulcanize',
		'images', 'assets', 'lib'], 'zip', callback);
});

// clean all output directories
gulp.task('clean-all', function() {
	return del(['dist', 'dev']);
});

// clean output directories
gulp.task('clean', function() {
	return del(isProd ? 'dist' : 'dev');
});

// manifest.json
gulp.task('manifest', function() {
	return gulp.src(base.src + 'manifest.json')
	.pipe(plugins.changed(isProd ? base.dist : base.dev))
	.pipe((isProd && !isProdTest) ? plugins.stripLine('"key":') : gutil.noop())
	.pipe(isProd ? gulp.dest(base.dist) : gulp.dest(base.dev));
});

// prep bower files
gulp.task('bower', function() {
	return gulp.src(files.bower)
	.pipe(plugins.if('*.html', plugins.crisper({scriptInHead: false})))
	.pipe(gulp.dest(path.bower.dev));
});

// Lint JavaScript
gulp.task('lintjs', function() {
	return gulp.src([files.scripts, files.elements, 'gulpfile.js'])
		.pipe(plugins.changed(path.scripts.dev))
		.pipe(plugins.changed(path.elements.dev))
		.pipe(plugins.changed(base.dev))
		.pipe(plugins.eslint())
		.pipe(plugins.eslint.format())
		.pipe(plugins.eslint.failAfterError());
});

// scripts - lint first
gulp.task('scripts', ['lintjs'], function() {
	return gulp.src(files.scripts)
	.pipe(plugins.changed(isProd ? path.scripts.dist : path.scripts.dev))
	.pipe(isProd ? plugins.uglify() : gutil.noop())
	.pipe(isProd ? gulp.dest(path.scripts.dist) : gulp.dest(path.scripts.dev));
});

// html
gulp.task('html', function() {
	return gulp.src(files.html)
	.pipe(plugins.changed(isProd ? path.html.dist : path.html.dev))
	.pipe((isProd && !isProdTest) ? gutil.noop() :
		plugins.replace('<!--@@build:replace -->', '<!--'))
	.pipe(isProd ? plugins.minifyHtml() : gutil.noop())
	.pipe(isProd ? gulp.dest(path.html.dist) : gulp.dest(path.html.dev));
});

// elements - lint first
gulp.task('elements', ['lintjs'], function() {
	return gulp.src(files.elements)
	.pipe(plugins.changed(path.elements.dev))
	.pipe(plugins.if('*.html', plugins.crisper({scriptInHead: false})))
	.pipe(gulp.dest(path.elements.dev));
});

// styles
gulp.task('styles', function() {
	return gulp.src(files.styles)
	.pipe(plugins.changed(isProd ? path.styles.dist : path.styles.dev))
	.pipe(plugins.if('*.css', isProd ? plugins.minifyCss() : gutil.noop()))
	.pipe(isProd ? gulp.dest(path.styles.dist) : gulp.dest(path.styles.dev));
});

// images
gulp.task('images', function() {
	return gulp.src(files.images)
	.pipe(plugins.changed(isProd ? path.images.dist : path.images.dev))
	.pipe(plugins.imagemin({progressive: true, interlaced: true}))
	.pipe(isProd ? gulp.dest(path.images.dist) : gulp.dest(path.images.dev));
});

// assets
gulp.task('assets', function() {
	return gulp.src(files.assets)
	.pipe(plugins.changed(isProd ? path.assets.dist : path.assets.dev))
	.pipe(isProd ? gulp.dest(path.assets.dist) : gulp.dest(path.assets.dev));
});

// lib
gulp.task('lib', function() {
	return gulp.src(files.lib)
	.pipe(plugins.changed(isProd ? path.lib.dist : path.lib.dev))
	.pipe(isProd ? gulp.dest(path.lib.dist) : gulp.dest(path.lib.dev));
});

// vulcanize for production
gulp.task('vulcanize', function() {
	return gulp.src(path.elements.src + 'elements.html')
	.pipe(plugins.vulcanize({stripComments: true, inlineCss: true,
		inlineScripts: true}))
	.pipe(plugins.crisper({scriptInHead: false}))
	.pipe(plugins.if('*.html', plugins.minifyInline({css: false})))
	.pipe(plugins.if('*.js', plugins.uglify()))
	.pipe(gulp.dest(path.elements.dist));
});

// compress for the Chrome Web Store
gulp.task('zip', function() {
	return gulp.src(base.dist + '**')
	.pipe(!isProdTest ?
		plugins.zip('store.zip') : plugins.zip('store-test.zip'))
	.pipe(!isProdTest ? gulp.dest(base.store) : gulp.dest('dist'));
});

// track changes in development
gulp.task('watch', ['manifest', 'scripts', 'html', 'styles', 'elements',
	'images', 'assets', 'lib'], function() {

	gulp.watch(files.manifest, ['manifest']).on('change', onChange);
	gulp.watch([files.scripts, 'gulpfile.js'], ['scripts'])
		.on('change', onChange);
	gulp.watch(files.html, ['html']).on('change', onChange);
	gulp.watch(files.styles, ['styles']).on('change', onChange);
	gulp.watch(files.elements, ['elements']).on('change', onChange);
	gulp.watch(files.images, ['images']).on('change', onChange);
	gulp.watch(files.assets, ['assets']).on('change', onChange);
	gulp.watch(files.lib, ['lib']).on('change', onChange);

});

