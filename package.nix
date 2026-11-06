{
  lib,
  stdenv,
  nodejs,
  yarn-berry_4,
  makeWrapper,
}:

# Yarn 4 Plug'n'Play project: deps come from a fixed-output offline cache,
# tsc compiles src/ to dist-js/, and the executable is node with the PnP
# runtime preloaded. `yarn test` runs in checkPhase, so a red test fails the
# build. nodejs is the same one yarn-berry_4 is built with (no Node rebuild).
stdenv.mkDerivation (finalAttrs: {
  pname = "lunchlund";
  version = "0.1.0";

  src = lib.fileset.toSource {
    root = ./.;
    fileset = lib.fileset.unions [
      ./package.json
      ./yarn.lock
      ./tsconfig.json
      ./src
      ./tests
    ];
  };

  # Only yarn.lock feeds the cache, so source edits don't invalidate it.
  # After changing dependencies: set hash = lib.fakeHash, build, paste `got:`.
  offlineCache = yarn-berry_4.fetchYarnBerryDeps {
    yarnLock = ./yarn.lock;
    hash = "sha256-MfZ5WjQTvQzu1Mu+D3s3vny1UGFZRf3sPACdv9NvbH8=";
  };

  nativeBuildInputs = [
    nodejs
    yarn-berry_4
    yarn-berry_4.yarnBerryConfigHook
    makeWrapper
  ];

  buildPhase = ''
    runHook preBuild
    yarn compile
    runHook postBuild
  '';

  doCheck = true;
  checkPhase = ''
    runHook preCheck
    yarn test
    runHook postCheck
  '';

  installPhase = ''
    runHook preInstall
    app=$out/lib/lunchlund
    mkdir -p $app/.yarn
    cp -r package.json .pnp.cjs dist-js $app/
    [ -e .pnp.loader.mjs ] && cp .pnp.loader.mjs $app/
    cp -r .yarn/cache $app/.yarn/
    [ -d .yarn/unplugged ] && cp -r .yarn/unplugged $app/.yarn/
    makeWrapper ${lib.getExe nodejs} $out/bin/lunchlund \
      --add-flags "--require $app/.pnp.cjs $app/dist-js/index.js"
    runHook postInstall
  '';

  meta = {
    description = "Scrapes lunch menus near Mobilvägen 10, Lund and emits a static page";
    mainProgram = "lunchlund";
    platforms = lib.platforms.linux;
  };
})
