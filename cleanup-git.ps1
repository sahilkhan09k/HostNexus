# Git Cleanup Script - Remove .md files from tracking

Write-Output "Starting Git cleanup..."
Write-Output ""

# Remove all .md files from tracking
Write-Output "Removing .md files from Git tracking..."
git rm --cached *.md 2>$null
git rm --cached context/*.md -r 2>$null
git rm --cached specs/*.md -r 2>$null
git rm --cached Six-File+Context+Methodology/*.md -r 2>$null
git rm --cached apps/web/CLAUDE.md 2>$null
git rm --cached apps/web/AGENTS.md 2>$null

# Re-add README.md
Write-Output "Re-adding README.md..."
git add README.md
git add apps/api/DATABASE_SETUP.md 2>$null

# Show status
Write-Output ""
Write-Output "Changes to be committed:"
git status --short

Write-Output ""
Write-Output "Ready to commit? Run these commands:"
Write-Output ""
Write-Output "  git commit -m 'chore: remove documentation files from tracking'"
Write-Output "  git push origin main"
Write-Output ""
