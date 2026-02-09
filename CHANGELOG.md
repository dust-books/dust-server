## [0.7.3](https://github.com/dust-books/dust-server/compare/v0.7.2...v0.7.3) (2026-02-09)

### Bug Fixes

* **auth:** clear auth token from localStorage on logout ([b0f60ec](https://github.com/dust-books/dust-server/commit/b0f60ecd8b2edb40aa952b15e58e4c19553a33ea))

## [0.7.2](https://github.com/dust-books/dust-server/compare/v0.7.1...v0.7.2) (2026-02-05)

### Bug Fixes

* **client:** fix client build issues ([d2cfa0f](https://github.com/dust-books/dust-server/commit/d2cfa0fa987831de7f0036ea3760e52ec2aade1b))

## [0.7.1](https://github.com/dust-books/dust-server/compare/v0.7.0...v0.7.1) (2026-02-04)

### Bug Fixes

* **client:** fix client not being built as part of release ([2e661ba](https://github.com/dust-books/dust-server/commit/2e661ba4bf06145b4e20da00143b82bede99b700))

## [0.7.0](https://github.com/dust-books/dust-server/compare/v0.6.2...v0.7.0) (2026-01-31)

### Features

* customizable user agent w/r/t openlibrary ([55b0078](https://github.com/dust-books/dust-server/commit/55b0078a2adaf81fe654d78a335affd4422efeab))

### Code Refactoring

* **server:** import cleanup ([751a795](https://github.com/dust-books/dust-server/commit/751a795ac45bbdcb9f55820dd3a76e4717d63f64))

## [0.6.2](https://github.com/dust-books/dust-server/compare/v0.6.1...v0.6.2) (2026-01-11)

### Bug Fixes

* **authors:** fix author page payload, fix broken book images on author page ([b0740e3](https://github.com/dust-books/dust-server/commit/b0740e32d11f73cd35bf18aaed44681dfd0e9667))

## [0.6.1](https://github.com/dust-books/dust-server/compare/v0.6.0...v0.6.1) (2026-01-10)

### Bug Fixes

* **stdout:** fix stdout writing by using ref ([1bf046e](https://github.com/dust-books/dust-server/commit/1bf046e5c87e42fc4f58f025745446de24931036))

## [0.6.0](https://github.com/dust-books/dust-server/compare/v0.5.0...v0.6.0) (2026-01-10)

### Features

* **flags:** add --version and --help flags ([6e496e1](https://github.com/dust-books/dust-server/commit/6e496e100e3f8d79596c846e3447c2d045f3edef))

## [0.5.0](https://github.com/dust-books/dust-server/compare/v0.4.1...v0.5.0) (2026-01-08)

### Features

* **admin:** Allow refreshing metadata for a single book ([7ba7e4c](https://github.com/dust-books/dust-server/commit/7ba7e4c5aee832c5a8696e8c75d45e1819d67b91))

## [0.4.1](https://github.com/dust-books/dust-server/compare/v0.4.0...v0.4.1) (2026-01-06)

### Bug Fixes

* **static assets:** memory leak for static assets ([2228f0a](https://github.com/dust-books/dust-server/commit/2228f0a382a2aaaa0f11b8e6c495a27f0ffa44cf))

## [0.4.0](https://github.com/dust-books/dust-server/compare/v0.3.10...v0.4.0) (2026-01-05)

### Features

* **client:** ship with a bundled client ([8bf4297](https://github.com/dust-books/dust-server/commit/8bf4297ac00d84123edffbd466db3c73ab0b6de6))

## [0.3.10](https://github.com/dust-books/dust-server/compare/v0.3.9...v0.3.10) (2026-01-05)

### Bug Fixes

* **logging:** standardize by removing ending newlines from log lines ([6370857](https://github.com/dust-books/dust-server/commit/6370857b4ddcdbf722161fdb98b0e542e3dade08))

## [0.3.9](https://github.com/dust-books/dust-server/compare/v0.3.8...v0.3.9) (2026-01-04)

### Bug Fixes

* **currently-reading:** adjust percentages by *100 ([857ad11](https://github.com/dust-books/dust-server/commit/857ad114dbf3a0bad631381671942c6d1589b316))

## [0.3.8](https://github.com/dust-books/dust-server/compare/v0.3.7...v0.3.8) (2026-01-04)

### Bug Fixes

* **dates:** format dates using strftime ([07f765c](https://github.com/dust-books/dust-server/commit/07f765ca038a969d0c4b889c7cf133872d1a399c))

## [0.3.7](https://github.com/dust-books/dust-server/compare/v0.3.6...v0.3.7) (2026-01-04)

### Bug Fixes

* **db:** serialize threading mode for now ([83914bc](https://github.com/dust-books/dust-server/commit/83914bcf52f6c95666d7446454fc6859b4f4e613))

## [0.3.6](https://github.com/dust-books/dust-server/compare/v0.3.5...v0.3.6) (2026-01-04)

### Bug Fixes

* **logging:** better logging ([1f07dc6](https://github.com/dust-books/dust-server/commit/1f07dc6021cf9e43536680cc8aeed4b06c5eab00))

## [0.3.5](https://github.com/dust-books/dust-server/compare/v0.3.4...v0.3.5) (2026-01-03)

### Bug Fixes

* **background_task:** Kick off scan on boot, fixes [#19](https://github.com/dust-books/dust-server/issues/19) ([77c56b8](https://github.com/dust-books/dust-server/commit/77c56b82d953b3013e71712828e3c1b6e6f61a15))

## [0.3.4](https://github.com/dust-books/dust-server/compare/v0.3.3...v0.3.4) (2025-12-29)

### Bug Fixes

* **cover_manager:** pass flags for accessing cover path ([470847d](https://github.com/dust-books/dust-server/commit/470847d03cb744d4537e859375b70ba05b1a6054))

## [0.3.3](https://github.com/dust-books/dust-server/compare/v0.3.2...v0.3.3) (2025-12-29)

### Bug Fixes

* **cover:** logging and debug-first releases ([5b732a3](https://github.com/dust-books/dust-server/commit/5b732a360cbd9553acee3fd11edfb96089f77c37))

## [0.3.2](https://github.com/dust-books/dust-server/compare/v0.3.1...v0.3.2) (2025-12-28)

### Bug Fixes

* **cover_manager:** additional logging ([fa37f8e](https://github.com/dust-books/dust-server/commit/fa37f8ef49a0932b000c0ab0154315914a1700ae))

## [0.3.1](https://github.com/dust-books/dust-server/compare/v0.3.0...v0.3.1) (2025-12-28)

### Bug Fixes

* **users:** fix memory leak w/r/t oneAlloc ([cd8c896](https://github.com/dust-books/dust-server/commit/cd8c896dcf9f76a7cefdd96a4d32873c250116b2))

## [0.3.0](https://github.com/dust-books/dust-server/compare/v0.2.0...v0.3.0) (2025-12-27)

### Features

* cover manager ([6a9ed61](https://github.com/dust-books/dust-server/commit/6a9ed61411d7a6ebf963868589a2e5815b640e0d))

## [0.2.0](https://github.com/dust-books/dust-server/compare/v0.1.5...v0.2.0) (2025-12-27)

### Features

* **background-jobs:** move to arena allocators ([c3e648b](https://github.com/dust-books/dust-server/commit/c3e648bdd57a45fc86f2790de72ec91059ad96b4))

### Code Refactoring

* wire up new scanner ([6b165d7](https://github.com/dust-books/dust-server/commit/6b165d739d82a539abd0fcc3d9c41e2c9ef16e11))

## [0.1.5](https://github.com/dust-books/dust-server/compare/v0.1.4...v0.1.5) (2025-12-26)

### Bug Fixes

* **scanner:** adjustments to ISBN parsing ([02f282c](https://github.com/dust-books/dust-server/commit/02f282cd94739f3e14e2e35b2a8b4d3cc835beb1))

## [0.1.4](https://github.com/dust-books/dust-server/compare/v0.1.3...v0.1.4) (2025-12-26)

### Bug Fixes

* **metadata:** inconsistencies between scanner and metadata extractor (may want to DRY this up) ([ccb0839](https://github.com/dust-books/dust-server/commit/ccb083909e551d6caa6fbea476d8fc1058e263b6))

## [0.1.3](https://github.com/dust-books/dust-server/compare/v0.1.2...v0.1.3) (2025-12-23)

### Bug Fixes

* **scanner:** tighten up ISBN parsing ([fc51d90](https://github.com/dust-books/dust-server/commit/fc51d9011762761a8540583aaea56e973b534b4a))

### Code Refactoring

* **OpenLibraryClient:** decouple from http layer ([421eef5](https://github.com/dust-books/dust-server/commit/421eef5b61d7c100497611ad9ed329705ccb2a5f))

## [0.1.2](https://github.com/dust-books/dust-server/compare/v0.1.1...v0.1.2) (2025-12-22)

### Bug Fixes

* **scanner:** save isbn in db even if metadata lookup fails ([b4fe00d](https://github.com/dust-books/dust-server/commit/b4fe00d876224562f5c755ce6aa4f8c975402a55))

## [0.1.1](https://github.com/dust-books/dust-server/compare/v0.1.0...v0.1.1) (2025-12-22)

### Bug Fixes

* security around filepaths in API endpoints ([ff02c22](https://github.com/dust-books/dust-server/commit/ff02c22080165fd3372b2d46c61abdd479919661))

## [0.1.0](https://github.com/dust-books/dust-server/compare/v0.0.13...v0.1.0) (2025-12-22)

### Features

* Cover manager for book covers ([56894a0](https://github.com/dust-books/dust-server/commit/56894a089524884a225d2b2a08fce8bd330a641e))

## [0.0.13](https://github.com/dust-books/dust-server/compare/v0.0.12...v0.0.13) (2025-12-22)

### Bug Fixes

* **scanner:** parsing of author and book name ([ebe9c33](https://github.com/dust-books/dust-server/commit/ebe9c33749e02835b91e913948018ab47eec981d))

## [0.0.12](https://github.com/dust-books/dust-server/compare/v0.0.11...v0.0.12) (2025-12-22)

### Bug Fixes

* **scanner:** fix book insertion query ([16d7fa2](https://github.com/dust-books/dust-server/commit/16d7fa2b537d0beca54f3ca60c1c6f99b2c582a5))

## [0.0.11](https://github.com/dust-books/dust-server/compare/v0.0.10...v0.0.11) (2025-12-22)

### Bug Fixes

* **scanner:** fix broken sql query ([78fa865](https://github.com/dust-books/dust-server/commit/78fa8655b3045f6b1f17ef5279a779460bf97c4c))

## [0.0.10](https://github.com/dust-books/dust-server/compare/v0.0.9...v0.0.10) (2025-12-21)

### Bug Fixes

* **background-jobs:** make interval configurable ([59e342f](https://github.com/dust-books/dust-server/commit/59e342f6d5384a294f4dac8f9332b6d78a4cb04e))

## [0.0.9](https://github.com/dust-books/dust-server/compare/v0.0.8...v0.0.9) (2025-12-21)

### Bug Fixes

* **scanner:** scan more book types, not just epub ([47cef13](https://github.com/dust-books/dust-server/commit/47cef13f1a66a233224c59ae914c16a0796b6592))

## [0.0.8](https://github.com/dust-books/dust-server/compare/v0.0.7...v0.0.8) (2025-12-21)

### Bug Fixes

* first user is admin user ([0174055](https://github.com/dust-books/dust-server/commit/017405581e946b84ba72a4155d0655985c77fa29))

## [0.0.7](https://github.com/dust-books/dust-server/compare/v0.0.6...v0.0.7) (2025-12-21)

### Bug Fixes

* **server:** binding on all addresses ([f1f345a](https://github.com/dust-books/dust-server/commit/f1f345ae063c9eaa26f174014491ffbd837e45a1))

## [0.0.6](https://github.com/dust-books/dust-server/compare/v0.0.5...v0.0.6) (2025-12-20)

### Bug Fixes

* static link sqlite ([bd74358](https://github.com/dust-books/dust-server/commit/bd74358c0381290aa7cb1bac8aeffd07845a41e6))

## [0.0.5](https://github.com/dust-books/dust-server/compare/v0.0.4...v0.0.5) (2025-12-20)

### Bug Fixes

* **installer:** dont write logs to stdout ([8d1b275](https://github.com/dust-books/dust-server/commit/8d1b2755c3992c6a074b9863a2c2f90b4d10a095))

## [0.0.4](https://github.com/dust-books/dust-server/compare/v0.0.3...v0.0.4) (2025-12-20)

### Bug Fixes

* **install:** handle non-interactive properly ([0d2984d](https://github.com/dust-books/dust-server/commit/0d2984d3604958b6a1c40d96d19f2e16a238f104))

## [0.0.3](https://github.com/dust-books/dust-server/compare/v0.0.2...v0.0.3) (2025-12-20)

### Bug Fixes

* **install:** handle unknown term types ([becee7d](https://github.com/dust-books/dust-server/commit/becee7db365e450e7e103b6e3df702710388ee3d))

## [0.0.2](https://github.com/dust-books/dust-server/compare/v0.0.1...v0.0.2) (2025-12-20)

### Bug Fixes

* **context:** simplify optional usage ([3c7a7e5](https://github.com/dust-books/dust-server/commit/3c7a7e5c9c5f8508aaac2b2e76b173564a2678fc))
