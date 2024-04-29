async function init() {
  const reposResponse = await fetch("repositories.json");
  if (!reposResponse.ok) {
    console.error("Failed to fetch repository list:", reposResponse.statusText);
    return;
  }
  const reposData = await reposResponse.json();
  const select = document.getElementById("repository-select");
  reposData.repositories.forEach((repo) => {
    const option = document.createElement("option");
    option.value = repo;
    option.textContent = repo;
    select.appendChild(option);
  });
  select.addEventListener("change", () => {
    if (select.value) {
      setupRepositoryTitle(select.value);
      fetchData(select.value);
    }
  });
}

function setupRepositoryTitle(repo) {
  const statsDiv = document.getElementById("stats");
  statsDiv.innerHTML = ""; // Clear previous content
  const header = document.createElement("h2");
  header.innerHTML = `<a href="https://github.com/${repo}" target="_blank">${repo}</a>`;
  statsDiv.appendChild(header);
}

async function fetchData(repo) {
  const authors = {};

  try {
    // Process Commits, PRs, Reviews
    await processItems(repo, "commits", authors, updateCommits);
    await processItems(repo, "pulls?state=all", authors, updatePullRequests);
    await processItems(repo, "pulls/comments", authors, updateCodeReviews);

    // Display user stats
    Object.entries(authors).forEach(async ([username, stats]) => {
      const userDetails = await fetchUserDetails(username);
      if (userDetails) {
        displayUserStats(repo, username, userDetails, stats);
      }
    });
  } catch (error) {
    console.error(`Error fetching data for ${repo}:`, error);
  }
}

async function fetchUserDetails(username) {
  const response = await fetch(`https://api.github.com/users/${username}`);
  if (response.ok) {
    return await response.json();
  } else {
    console.error("Failed to fetch user details:", response.statusText);
    return null; // Return null if there's an error fetching user details
  }
}

function displayUserStats(repo, username, userDetails, stats) {
  const statsDiv = document.getElementById("stats");
  const userDiv = document.createElement("div");
  userDiv.innerHTML = `
      <img src="${
        userDetails.avatar_url
      }" alt="${username}'s avatar" style="width: 50px; height: auto;">
      <strong><a href="${
        userDetails.html_url
      }" target="_blank">@${username}</a></strong> (${
    userDetails.email || "No public email"
  })
      <div>${userDetails.name || "Name not available"}</div>
      <p>Commits: <a href="https://github.com/${repo}/commits?author=${username}" target="_blank">${
    stats.commits
  }</a>, 
         Pull Requests: <a href="https://github.com/${repo}/pulls?q=is%3Apr+author%3A${username}" target="_blank">${
    stats.prs
  }</a>, 
         Code Reviews: <a href="https://github.com/${repo}/pulls?q=is%3Apr+reviewed-by%3A${username}" target="_blank">${
    stats.reviews
  }</a></p>`;
  statsDiv.appendChild(userDiv);
}

async function processItems(repo, endpoint, authors, updateFunction) {
  let url = `https://api.github.com/repos/${repo}/${endpoint}?per_page=100`;
  while (url) {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`GitHub API Error: ${response.statusText}`);
    }
    const data = await response.json();
    data.forEach((item) => updateFunction(item, authors));
    url = getNextPageUrl(response.headers.get("link"));
  }
}

function updateCommits(commit, authors) {
  const username = commit.author ? commit.author.login : null;
  if (username) {
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

init(); // Initialize dropdown and event listeners
