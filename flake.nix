{
  description = "lunchlund: weekday lunch menus near Mobilvägen 10, Lund";

  inputs.nixpkgs.url = "github:NixOS/nixpkgs/nixos-26.05";

  outputs =
    { self, nixpkgs }:
    let
      systems = [ "x86_64-linux" ];
      forAllSystems = f: nixpkgs.lib.genAttrs systems (system: f nixpkgs.legacyPackages.${system});
    in
    {
      packages = forAllSystems (pkgs: rec {
        lunchlund = pkgs.callPackage ./package.nix { };
        default = lunchlund;
      });

      checks = forAllSystems (pkgs: {
        lunchlund = self.packages.${pkgs.stdenv.hostPlatform.system}.lunchlund;
        module = import ./nix/module-check.nix {
          inherit pkgs nixpkgs;
          module = self.nixosModules.default;
        };
      });

      nixosModules.default = import ./nix/module.nix { inherit self; };
    };
}
