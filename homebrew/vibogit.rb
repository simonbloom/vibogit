class Vibogit < Formula
  desc "Local daemon for ViboGit - Web-based Git client"
  homepage "https://github.com/simonbloom/vibogit"
  url "https://github.com/simonbloom/vibogit/archive/refs/tags/v0.1.0.tar.gz"
  sha256 "PLACEHOLDER_SHA256"
  license "MIT"

  depends_on "bun"

  def install
    cd "apps/daemon" do
      system "bun", "install"
      system "bun", "build", "src/index.ts", "--outdir", "dist", "--target", "bun"
      
      libexec.install "dist"
      libexec.install "src"
      
      (bin/"vibogit-daemon").write <<~EOS
        #!/bin/bash
        exec "#{Formula["bun"].opt_bin}/bun" run "#{libexec}/dist/index.js" "$@"
      EOS
    end
  end

  service do
    run [opt_bin/"vibogit-daemon"]
    keep_alive true
    working_dir HOMEBREW_PREFIX
    log_path var/"log/vibogit-daemon.log"
    error_log_path var/"log/vibogit-daemon.error.log"
  end

  test do
    # Test that the daemon starts and responds to health check
    fork do
      exec bin/"vibogit-daemon"
    end
    sleep 2
    
    output = shell_output("curl -s http://localhost:9111/health")
    assert_equal "OK", output
  end
end
