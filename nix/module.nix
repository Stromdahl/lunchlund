{ self }:
{
  config,
  lib,
  pkgs,
  ...
}:
let
  cfg = config.services.lunchlund;

  # Why not StateDirectory=lunchlund: with DynamicUser=yes systemd puts state
  # directories under /var/lib/private (mode 0700, root) and only symlinks
  # /var/lib/lunchlund to it (systemd.exec(5), "If DynamicUser= is used, the
  # logic for ... StateDirectory= is slightly altered"). A web server user can
  # never traverse that, whatever the file modes. So the output root is a plain
  # directory made by tmpfiles: root-owned, setgid, group = cfg.group (a
  # dedicated static group the module creates, "lunchlund" by default), mode
  # 2770. The unit joins cfg.group and runs with UMask=0007, so everything it
  # writes is group-readable and group-writable (a later run under a recycled
  # dynamic UID can still delete old builds). The web server gets read access
  # by joining that group on the host:
  #   users.users.caddy.extraGroups = [ "lunchlund" ];
  # The scraper deliberately does not join the web server's group: that would
  # let a compromised scraper read whatever the web server keeps group-readable
  # (e.g. Caddy's state dir). Cost: the web server can also write here.
  # Don't add StateDirectory=lunchlund later: systemd would migrate this
  # directory into /var/lib/private.
  root = "/var/lib/lunchlund";

  # Atomic publish: build into a fresh build-XXXXXX dir next to `current`, then
  # repoint the relative `current` symlink with a rename (mv -T is rename(2)),
  # so readers see either the old page or the new one, never a half-written
  # one. Any failure before the swap removes the temp dir and leaves `current`
  # untouched. Old builds are deleted only after a successful swap.
  # "Failure" means lunchlund exits non-zero; a scraper that can't reach its
  # site still yields an error card (or a same-week fallback) and exit 0.
  # The build dir is made with plain mkdir, not `mktemp -d` + chmod: mktemp
  # makes it 0700, and chmod can't fix that because DynamicUser implies
  # RestrictSUIDSGID, which refuses any chmod carrying the inherited setgid
  # bit. mkdir under UMask=0007 gives 0770 and inherits setgid + group itself.
  publish = pkgs.writeShellScript "lunchlund-publish" ''
    set -euo pipefail
    root=${root}
    tmp=$(mktemp -u "$root/build-XXXXXX")
    mkdir -- "$tmp"
    swapped=
    cleanup() { [ -n "$swapped" ] || rm -rf -- "$tmp"; }
    trap cleanup EXIT

    ${lib.getExe cfg.package} --out "$tmp" --cache "$root/current/lunchlund.json"

    ln -sfn -- "$(basename "$tmp")" "$root/current.new"
    mv -T -- "$root/current.new" "$root/current"
    swapped=1

    for old in "$root"/build-*; do
      [ "$old" = "$tmp" ] && continue
      rm -rf -- "$old" || echo "lunchlund: could not remove old build $old" >&2
    done
  '';
in
{
  options.services.lunchlund = {
    enable = lib.mkEnableOption "the lunchlund lunch-menu page, rebuilt on a schedule";

    package = lib.mkOption {
      type = lib.types.package;
      default = self.packages.${pkgs.stdenv.hostPlatform.system}.default;
      defaultText = lib.literalExpression "lunchlund.packages.\${system}.default";
      description = "The lunchlund package to run.";
    };

    schedule = lib.mkOption {
      type = lib.types.listOf lib.types.str;
      example = [
        "Mon..Fri 07:15 Europe/Stockholm"
        "Mon..Fri 10:00 Europe/Stockholm"
      ];
      description = ''
        systemd OnCalendar expressions (see systemd.time(7)) for when to
        rebuild the page. Qualify them with a timezone.
      '';
    };

    group = lib.mkOption {
      type = lib.types.str;
      default = "lunchlund";
      description = ''
        Dedicated group that owns the output; the module creates it. Add the
        web server's user to it, e.g.
        `users.users.caddy.extraGroups = [ "lunchlund" ]`.
      '';
    };

    outputDir = lib.mkOption {
      type = lib.types.str;
      readOnly = true;
      default = "${root}/current";
      description = ''
        Directory holding the latest page (index.html, lunchlund.json,
        lunchlund.xml). A symlink swapped atomically on each successful run;
        point the web server's root at it.
      '';
    };
  };

  config = lib.mkIf cfg.enable {
    users.groups.${cfg.group} = { };

    systemd.tmpfiles.rules = [ "d ${root} 2770 root ${cfg.group} - -" ];

    systemd.services.lunchlund = {
      description = "Rebuild the lunchlund lunch-menu page";
      wants = [ "network-online.target" ];
      after = [ "network-online.target" ];
      path = [ pkgs.coreutils ];
      serviceConfig = {
        Type = "oneshot";
        ExecStart = publish;
        DynamicUser = true;
        # Not "lunchlund": the dynamic user defaults to the unit name, and a
        # static group of that name makes systemd demand a static user too
        # (systemd.exec(5), User=), failing the unit with 217/USER.
        User = "lunchlund-scraper";
        SupplementaryGroups = [ cfg.group ];
        UMask = "0007";
        ReadWritePaths = [ root ];
        NoNewPrivileges = true;
        PrivateTmp = true;
        ProtectSystem = "strict";
        ProtectHome = true;
        PrivateDevices = true;
        ProtectKernelTunables = true;
        ProtectKernelModules = true;
        ProtectControlGroups = true;
        RestrictAddressFamilies = [
          "AF_INET"
          "AF_INET6"
          "AF_UNIX"
        ];
      };
    };

    systemd.timers.lunchlund = {
      description = "Rebuild the lunchlund page on schedule";
      wantedBy = [ "timers.target" ];
      timerConfig = {
        OnCalendar = cfg.schedule;
        Persistent = true;
      };
    };
  };
}
