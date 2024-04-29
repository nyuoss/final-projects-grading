async function fetchData() {
  const reposResponse = await fetch("repositories.json");
  if (!reposResponse.ok) {
    console.error("Failed to fetch repository list:", reposResponse.statusText);
    return;
  }
  const reposData = await reposResponse.json();

  for (const repo of reposData.repositories) {
    const repoStats = document.createElement("div");
    repoStats.innerHTML = `<h2>${repo}</h2>`;
    document.getElementById("stats").appendChild(repoStats);

    // Initialize a map to store author data
    const authors = {};

    try {
      // Fetch commits with pagination
      await processItems(repo, "commits", authors, updateCommits);

      // Fetch PRs with pagination
      await processItems(repo, "pulls?state=all", authors, updatePullRequests);

      // Fetch PR reviews with pagination
      await processItems(repo, "pulls/comments", authors, updateCodeReviews);
    } catch (error) {
      console.error(`Error fetching data for ${repo}:`, error);
      continue; // Skip to the next repository if an error occurs
    }

    // Display author-specific stats
    for (const [username, stats] of Object.entries(authors)) {
      const authorDiv = document.createElement("div");
      authorDiv.innerHTML = `<strong>${username}</strong>: Commits: ${stats.commits}, Pull Requests: ${stats.prs}, Code Reviews: ${stats.reviews}`;
      repoStats.appendChild(authorDiv);
    }
  }

  // Refresh data every 1 hour
  setTimeout(fetchData, 3600000);
}

async function processItems(repo, type, authors, updateFunction) {
  let url = `https://api.github.com/repos/${repo}/${type}?per_page=100`;
  while (url) {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`GitHub API Error: ${response.statusText}`);
    }
    const linkHeader = response.headers.get("link");
    const data = await response.json();
    data.forEach((item) => updateFunction(item, authors));
    url = getNextPageUrl(linkHeader);
  }
}

function updateCommits(commit, authors) {
  if (commit.author) {
    const username = commit.author.login;
    if (!authors[username]) {
      authors[username] = { commits: 0, prs: 0, reviews: 0 };
    }
    authors[username].commits++;
  }
}

function updatePullRequests(pr, authors) {
  const username = pr.user.login;
  if (!authors[username]) {
    authors[username] = { commits: 0, prs: 0, reviews: 0 };
  }
  authors[username].prs++;
}

function updateCodeReviews(review, authors) {
  const username = review.user.login;
  if (!authors[username]) {
    authors[username] = { commits: 0, prs: 0, reviews: 0 };
  }
  authors[username].reviews++;
}

function getNextPageUrl(linkHeader) {
  if (!linkHeader) return null;
  const links = linkHeader.split(",").map((a) => a.split(";"));
  const nextLink = links.find((link) => link[1].includes('rel="next"'));
  return nextLink ? nextLink[0].trim().replace(/<|>/g, "") : null;
}

fetchData();
