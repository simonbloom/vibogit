cask "vibogit" do
  version "0.1.0"
  sha256 "REPLACE_WITH_ACTUAL_SHA256"

  url "https://github.com/vibogit/vibogit/releases/download/v#{version}/ViboGit_#{version}_universal.dmg"
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
