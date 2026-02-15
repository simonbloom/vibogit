cask "vibogit" do
  version "3.1.0"
  sha256 "e247c8cf8f43f7a732db8ab53f20498e179d58f83a288dc8bd5e68ad6e98f68b"

  url "https://github.com/vibogit/vibogit/releases/download/v#{version}/ViboGit_#{version}_aarch64.dmg"
  name "ViboGit"
  desc "Git for the Vibe Coder - Beautiful, simple Git client"
  homepage "https://vibogit.app"

  livecheck do
    url :url
    strategy :github_latest
  end

  auto_updates true
  depends_on macos: ">= :catalina"

  app "ViboGit.app"

  zap trash: [
    "~/Library/Application Support/app.vibogit.desktop",
    "~/Library/Caches/app.vibogit.desktop",
    "~/Library/Preferences/app.vibogit.desktop.plist",
    "~/Library/Saved Application State/app.vibogit.desktop.savedState",
    "~/.vibogit",
  ]
end
