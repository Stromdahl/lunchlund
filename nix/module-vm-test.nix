# Runs the real unit in a VM with a stub lunchlund (no network needed): a
# successful run publishes a page the web server group can read, the next run
# gets the previous output as --cache, and a failing run leaves `current` as
# it was. Fail mode is toggled by touching /run/lunchlund-fail. A second node
# runs the real package under the same sandbox with no network: every scraper
# fails, yet the run succeeds and publishes error cards (no-network is not a
# failed run).
{ pkgs, module }:
let
  stub = pkgs.writeShellApplication {
    name = "lunchlund";
    text = ''
      out=""
      cache=""
      while [ $# -gt 0 ]; do
        case "$1" in
          --out) out=$2; shift 2 ;;
          --cache) cache=$2; shift 2 ;;
          *) shift ;;
        esac
      done
      if [ -e /run/lunchlund-fail ]; then
        echo "half" > "$out/index.html"
        echo "stub: failing on purpose" >&2
        exit 1
      fi
      prev=none
      [ -e "$cache" ] && prev=$(cat "$cache")
      echo "page $out" > "$out/index.html"
      echo "cache=$cache prev=$prev" > "$out/lunchlund.json"
      echo "<rss/>" > "$out/lunchlund.xml"
    '';
  };
in
pkgs.testers.runNixOSTest {
  name = "lunchlund-module";
  nodes.offline = {
    imports = [ module ];
    users.groups.caddy = { };
    services.lunchlund = {
      enable = true;
      schedule = [ "Mon..Fri 07:15 Europe/Stockholm" ];
    };
  };
  nodes.machine = {
    imports = [ module ];
    users.groups.caddy = { };
    users.users.caddy = {
      isSystemUser = true;
      group = "caddy";
    };
    services.lunchlund = {
      enable = true;
      package = stub;
      schedule = [ "Mon..Fri 07:15 Europe/Stockholm" ];
    };
  };
  testScript = ''
    root = "/var/lib/lunchlund"
    start_all()
    machine.wait_for_unit("multi-user.target")

    with subtest("first run publishes a page the web server can read"):
        machine.succeed("systemctl start lunchlund")
        target = machine.succeed(f"readlink {root}/current").strip()
        assert target.startswith("build-"), target
        machine.succeed(f"runuser -u caddy -- cat {root}/current/index.html")
        machine.succeed(f"runuser -u caddy -- cat {root}/current/lunchlund.json")
        mode = machine.succeed(f"stat -c '%a %G' {root}/current/ {root}/current/index.html").split()
        assert mode == ["2770", "caddy", "660", "caddy"], mode
        machine.fail("runuser -u nobody -- ls /var/lib/lunchlund/current")

    with subtest("next run reads the previous output as cache and drops old builds"):
        first = machine.succeed(f"cat {root}/current/lunchlund.json").strip()
        machine.succeed("systemctl start lunchlund")
        second = machine.succeed(f"cat {root}/current/lunchlund.json").strip()
        assert second == f"cache={root}/current/lunchlund.json prev={first}", second
        builds = machine.succeed(f"ls -d {root}/build-* | wc -l").strip()
        assert builds == "1", builds

    with subtest("a failed run leaves current untouched"):
        before = machine.succeed(f"readlink {root}/current; cat {root}/current/*")
        machine.succeed("touch /run/lunchlund-fail")
        machine.fail("systemctl start lunchlund")
        after = machine.succeed(f"readlink {root}/current; cat {root}/current/*")
        assert before == after, (before, after)
        builds = machine.succeed(f"ls -d {root}/build-* | wc -l").strip()
        assert builds == "1", builds
        machine.fail(f"test -e {root}/current.new")

    with subtest("the real package runs in the sandbox and publishes error cards offline"):
        offline.wait_for_unit("multi-user.target")
        offline.succeed("systemctl start lunchlund")
        offline.succeed(f"grep -q 'Kunde inte hämta menyn' {root}/current/index.html")
        offline.succeed(f"test -s {root}/current/lunchlund.json -a -s {root}/current/lunchlund.xml")
  '';
}
