# Token do gh evita o rate limit da API do GitHub (opcional)
GITHUB_TOKEN ?= $(shell gh auth token 2>/dev/null)
export GITHUB_TOKEN

.PHONY: update serve

# Regenera a seção de projetos do index.html a partir da API do GitHub
update:
	node scripts/update-projects.js

# Preview local em http://localhost:8000
serve:
	python3 -m http.server 8000
