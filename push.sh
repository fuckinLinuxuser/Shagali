commit_message=$(date +"%Y-%m-%d %H:%M")
git add .
git commit -m "$commit_message"
git push origin master
