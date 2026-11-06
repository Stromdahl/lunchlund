# Evaluates a minimal NixOS host with services.lunchlund enabled and asserts
# the unit wiring a host relies on. Fails at eval time (named assertions, a
# throw listing the failures), so `nix flake check` needs no VM.
{
  pkgs,
  nixpkgs,
  module,
}:
let
  inherit (pkgs) lib;
  schedule = [
    "Mon..Fri 07:15 Europe/Stockholm"
    "Mon..Fri 10:00 Europe/Stockholm"
  ];
  host = nixpkgs.lib.nixosSystem {
    inherit (pkgs.stdenv.hostPlatform) system;
    modules = [
      module
      {
        boot.loader.grub.enable = false;
        fileSystems."/" = {
          device = "none";
          fsType = "tmpfs";
        };
        system.stateVersion = "26.05";
        services.lunchlund = {
          enable = true;
          inherit schedule;
        };
      }
    ];
  };
  inherit (host) config;
  cfg = config.services.lunchlund;
  service = config.systemd.services.lunchlund or { };
  unit = service.serviceConfig or { };
  timer = (config.systemd.timers.lunchlund or { }).timerConfig or { };
  rules = config.systemd.tmpfiles.rules;
  checks = {
    "service runs as a DynamicUser" = (unit.DynamicUser or false) == true;
    "service is a oneshot" = (unit.Type or "") == "oneshot";
    "service waits for network-online" =
      lib.elem "network-online.target" (service.wants or [ ])
      && lib.elem "network-online.target" (service.after or [ ]);
    "service sets NoNewPrivileges" = (unit.NoNewPrivileges or false) == true;
    "service sets PrivateTmp" = (unit.PrivateTmp or false) == true;
    "service protects the system" = lib.elem (unit.ProtectSystem or null) [ "strict" "full" true ];
    "service protects home" = lib.elem (unit.ProtectHome or null) [ "read-only" "tmpfs" true ];
    "timer is Persistent" = (timer.Persistent or false) == true;
    "timer fires on the given schedule" = lib.toList (timer.OnCalendar or [ ]) == schedule;
    "timer is enabled at boot" = lib.elem "timers.target" ((config.systemd.timers.lunchlund or { }).wantedBy or [ ]);
    "outputDir is the current symlink under the output root" = cfg.outputDir == "/var/lib/lunchlund/current";
    "output root is not a StateDirectory (DynamicUser would hide it in /var/lib/private)" =
      !(unit ? StateDirectory);
    "service may write the output root" = lib.elem "/var/lib/lunchlund" (lib.toList (unit.ReadWritePaths or [ ]));
    "module creates the dedicated lunchlund group" = config.users.groups ? lunchlund;
    "output root is group-owned by the lunchlund group" =
      lib.any (r: r == "d /var/lib/lunchlund 2770 root lunchlund - -") rules;
    "service runs in the lunchlund group" =
      lib.elem "lunchlund" (lib.toList (unit.SupplementaryGroups or [ ]));
    # systemd.exec(5): a static group named like the dynamic user (which
    # defaults to the unit name) makes DynamicUser demand a static user too.
    "dynamic user is not named like the static lunchlund group" =
      (unit.User or "lunchlund") != "lunchlund";
    "service is not in the web server's group" =
      !(lib.elem "caddy" (lib.toList (unit.SupplementaryGroups or [ ])));
  };
  failed = lib.attrNames (lib.filterAttrs (_: ok: !ok) checks);
in
if failed == [ ] then
  pkgs.runCommand "lunchlund-module-check" { } "touch $out"
else
  throw "lunchlund module check failed:\n  - ${lib.concatStringsSep "\n  - " failed}"
