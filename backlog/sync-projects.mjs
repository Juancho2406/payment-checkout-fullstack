#!/usr/bin/env node
/**
 * Sync backlog/roadmap.json → GitHub Issues + Projects V2.
 *
 * Native linking (the point of this script):
 *   GitHub auto-closes / moves cards from `Closes #<issue-number>` in PRs and
 *   commits. It does NOT understand `#RM-07`. This script creates one issue per
 *   RM item and writes the issue number back into roadmap.json so the JSON stays
 *   the bidirectional source of truth.
 *
 * Usage:
 *   node backlog/sync-projects.mjs
 *   node backlog/sync-projects.mjs Juancho2406/payment-checkout-fullstack
 *
 * Requires: `gh` authenticated with `repo` and `project` scopes.
 * Idempotent: re-runs update existing issues / project items; they are not duplicated.
 */

import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..");
const ROADMAP_PATH = join(HERE, "roadmap.json");

const PROJECT_TITLE = "Payment Checkout — Roadmap";
const TITLE_SEP = " — ";

const KIND_LABELS = {
  feat: { color: "1D76DB", description: "Feature slice" },
  docs: { color: "0075CA", description: "Documentation" },
  chore: { color: "FEF2C0", description: "Repo / packaging chore" },
  ci: { color: "E4E669", description: "Continuous integration" },
  infra: { color: "BFD4F2", description: "Infrastructure" },
  test: { color: "0E8A16", description: "Tests and coverage" },
};

const KIND_FIELD_COLORS = {
  feat: "BLUE",
  docs: "PURPLE",
  chore: "GRAY",
  ci: "YELLOW",
  infra: "GREEN",
  test: "PINK",
};

const WAVE_FIELD_COLORS = {
  0: "GRAY",
  1: "BLUE",
  2: "GREEN",
  3: "PURPLE",
  4: "ORANGE",
};

const STATUS_OPTIONS = {
  planned: ["Todo", "To do", "To Do", "Backlog"],
  in_progress: ["In Progress", "In progress"],
  done: ["Done"],
};

function die(message) {
  console.error(`error: ${message}`);
  process.exit(1);
}

function gh(args, options = {}) {
  const result = spawnSync("gh", args, {
    encoding: "utf8",
    maxBuffer: 20 * 1024 * 1024,
    cwd: ROOT,
    ...options,
  });
  if (result.error) {
    if (result.error.code === "ENOENT") {
      die("gh CLI not found. Install GitHub CLI, then: gh auth login -s repo,project");
    }
    throw result.error;
  }
  if (result.status !== 0) {
    const err = `${result.stderr || ""}${result.stdout || ""}`.trim();
    const error = new Error(`gh ${args.join(" ")} failed (${result.status}): ${err}`);
    error.status = result.status;
    error.stderr = result.stderr;
    error.stdout = result.stdout;
    throw error;
  }
  return result.stdout ?? "";
}

function ghAllowFail(args, options = {}) {
  const result = spawnSync("gh", args, {
    encoding: "utf8",
    maxBuffer: 20 * 1024 * 1024,
    cwd: ROOT,
    ...options,
  });
  return result;
}

function graphql(query, variables = {}) {
  const result = ghAllowFail(["api", "graphql", "--input", "-"], {
    input: JSON.stringify({ query, variables }),
  });
  const raw = `${result.stdout || ""}${result.status !== 0 ? result.stderr || "" : ""}`.trim();
  let payload;
  try {
    payload = JSON.parse(result.stdout || "{}");
  } catch {
    throw new Error(`GraphQL response was not JSON: ${raw}`);
  }
  if (payload.errors?.length) {
    throw new Error(payload.errors.map((e) => e.message).join("\n"));
  }
  if (result.status !== 0) {
    throw new Error(raw || `gh api graphql exited ${result.status}`);
  }
  return payload.data;
}

function parseOwnerRepo(input) {
  const cleaned = input
    .replace(/^git@github\.com:/, "")
    .replace(/^https:\/\/github\.com\//, "")
    .replace(/\.git$/, "")
    .trim();
  const parts = cleaned.split("/").filter(Boolean);
  if (parts.length < 2) die(`cannot parse owner/repo from: ${input}`);
  return { owner: parts.at(-2), repo: parts.at(-1) };
}

function resolveRepo() {
  const arg = process.argv[2];
  if (arg) return parseOwnerRepo(arg);
  try {
    const json = JSON.parse(gh(["repo", "view", "--json", "nameWithOwner,url,visibility"]));
    const { owner, repo } = parseOwnerRepo(json.nameWithOwner);
    return { owner, repo, visibility: json.visibility, url: json.url };
  } catch {
    const remote = gh(["remote", "get-url", "origin"]).trim();
    return parseOwnerRepo(remote);
  }
}

function loadRoadmap() {
  return JSON.parse(readFileSync(ROADMAP_PATH, "utf8"));
}

function saveRoadmap(roadmap) {
  writeFileSync(ROADMAP_PATH, `${JSON.stringify(roadmap, null, 2)}\n`);
}

function issueTitle(item) {
  return `${item.id}${TITLE_SEP}${item.title}`;
}

function waveOptionName(roadmap, wave) {
  const label = roadmap.waves?.[String(wave)] ?? `Wave ${wave}`;
  return `${wave} · ${label}`;
}

function markdownBody(item, roadmap, idToIssue) {
  const waveName = waveOptionName(roadmap, item.wave);
  const deps = (item.dependsOn ?? []).map((id) => {
    const dep = roadmap.items.find((i) => i.id === id);
    const num = idToIssue.get(id)?.number;
    const title = dep ? dep.title : id;
    return num ? `- ${id} — #${num} (${title})` : `- ${id} (${title})`;
  });
  const commits = (item.commits ?? []).filter((c) => c.sha);
  const commitLines = commits.length
    ? commits.map((c) => {
        const sha = c.sha;
        const short = sha.slice(0, 7);
        return `- \`${c.message}\` (\`${short}\`)`;
      })
    : ["_None yet. The finishing PR/commit should say `Closes #<this-issue-number>`._"];
  const introduces = (item.introduces ?? []).map((p) => `\`${p}\``).join(", ") || "_n/a_";
  const issueNumber = item.githubIssue?.number;

  return [
    item.summary,
    "",
    "| Field | Value |",
    "|---|---|",
    `| id | \`${item.id}\` |`,
    `| wave | ${waveName} |`,
    `| kind | \`${item.kind}\` |`,
    `| status | \`${item.status}\` |`,
    `| plannedCommit | \`${item.plannedCommit}\` |`,
    `| introduces | ${introduces} |`,
    "",
    "### Depends on",
    "",
    deps.length ? deps.join("\n") : "_None._",
    "",
    "### Native linking",
    "",
    "GitHub only auto-links `#<issue-number>` (for example `#12`). It does **not** understand `#RM-07`.",
    issueNumber
      ? `Finish this slice with **\`Closes #${issueNumber}\`** in the PR or commit. The human id \`${item.id}\` in commit messages is for humans; it does not move this card.`
      : `Finish this slice with **\`Closes #<issue-number>\`** in the PR or commit. The human id \`${item.id}\` in commit messages is for humans; it does not move this card.`,
    "",
    "### Commits",
    "",
    ...commitLines,
    "",
  ].join("\n");
}

function ensureLabels(owner, repo) {
  const existing = JSON.parse(
    gh(["label", "list", "-R", `${owner}/${repo}`, "--limit", "100", "--json", "name"]),
  );
  const names = new Set(existing.map((l) => l.name));
  for (const [name, meta] of Object.entries(KIND_LABELS)) {
    const args = [
      "label",
      "create",
      name,
      "-R",
      `${owner}/${repo}`,
      "--color",
      meta.color,
      "--description",
      meta.description,
    ];
    if (names.has(name)) args.push("--force");
    gh(args);
  }
}

function findProject(owner, roadmap) {
  const stored = roadmap.github?.project?.number;
  if (stored) {
    try {
      const data = graphql(
        `query ($login: String!, $number: Int!) {
          user(login: $login) {
            projectV2(number: $number) { id number title url public }
          }
        }`,
        { login: owner, number: stored },
      );
      if (data.user?.projectV2) return data.user.projectV2;
    } catch {
      // Fall through to title search.
    }
  }
  const listed = JSON.parse(gh(["project", "list", "--owner", owner, "--limit", "100", "--format", "json"]));
  const match = (listed.projects ?? []).find((p) => p.title === PROJECT_TITLE && !p.closed);
  if (match) {
    return { id: match.id, number: match.number, title: match.title, url: match.url, public: match.public };
  }
  return null;
}

function ensureProject(owner, repo, roadmap, isPublic) {
  let project = findProject(owner, roadmap);
  if (!project) {
    console.log(`creating project "${PROJECT_TITLE}"…`);
    const created = JSON.parse(
      gh(["project", "create", "--owner", owner, "--title", PROJECT_TITLE, "--format", "json"]),
    );
    project = {
      id: created.id,
      number: created.number,
      title: created.title,
      url: created.url,
      public: created.public,
    };
  } else {
    console.log(`using existing project #${project.number} ${project.url}`);
  }

  const visibility = isPublic ? "PUBLIC" : "PRIVATE";
  gh([
    "project",
    "edit",
    String(project.number),
    "--owner",
    owner,
    "--visibility",
    visibility,
    "--description",
    "Kata roadmap: one issue per RM-NN slice. Group the board by Wave. Close cards with Closes #<issue-number>.",
    "--readme",
    [
      "# Payment Checkout — Roadmap",
      "",
      "Each card is one `RM-NN` slice from `backlog/roadmap.json`.",
      "",
      "- **Group this board by `Wave`** (View → Group by → Wave) so the five phases are swimlanes.",
      "- Status: Todo / In Progress / Done.",
      "- Kind: feat, docs, chore, ci, infra, test.",
      "- Finish a slice with `Closes #<issue-number>` in the PR or commit. `#RM-07` does **not** move the card.",
      "",
      `Sync: \`node backlog/sync-projects.mjs ${owner}/${repo}\``,
      "",
    ].join("\n"),
  ]);

  try {
    gh(["project", "link", String(project.number), "--owner", owner, "--repo", `${owner}/${repo}`]);
  } catch (err) {
    console.warn(`warn: could not link project to repo: ${err.message}`);
  }

  const refreshed = graphql(
    `query ($login: String!, $number: Int!) {
      user(login: $login) {
        projectV2(number: $number) { id number title url public }
      }
    }`,
    { login: owner, number: project.number },
  ).user.projectV2;

  return refreshed;
}

function listProjectFields(projectId) {
  const data = graphql(
    `query ($id: ID!) {
      node(id: $id) {
        ... on ProjectV2 {
          fields(first: 40) {
            nodes {
              __typename
              ... on ProjectV2Field { id name dataType }
              ... on ProjectV2SingleSelectField {
                id name dataType
                options { id name color }
              }
            }
          }
          views(first: 10) {
            nodes { id name layout }
          }
        }
      }
    }`,
    { id: projectId },
  );
  return {
    fields: data.node.fields.nodes,
    views: data.node.views.nodes,
  };
}

function createSingleSelectField(projectId, name, options) {
  const data = graphql(
    `mutation ($projectId: ID!, $name: String!, $options: [ProjectV2SingleSelectFieldOptionInput!]!) {
      createProjectV2Field(input: {
        projectId: $projectId
        dataType: SINGLE_SELECT
        name: $name
        singleSelectOptions: $options
      }) {
        projectV2Field {
          ... on ProjectV2SingleSelectField {
            id name
            options { id name color }
          }
        }
      }
    }`,
    { projectId, name, options },
  );
  return data.createProjectV2Field.projectV2Field;
}

function ensureFields(projectId, roadmap) {
  let { fields, views } = listProjectFields(projectId);

  const byName = () => Object.fromEntries(fields.map((f) => [f.name, f]));

  if (!byName().Wave) {
    console.log("creating Wave field…");
    createSingleSelectField(
      projectId,
      "Wave",
      Object.keys(roadmap.waves)
        .sort((a, b) => Number(a) - Number(b))
        .map((key) => ({
          name: waveOptionName(roadmap, Number(key)),
          color: WAVE_FIELD_COLORS[key] ?? "GRAY",
          description: roadmap.waves[key],
        })),
    );
    ({ fields, views } = listProjectFields(projectId));
  }

  if (!byName().Kind) {
    console.log("creating Kind field…");
    createSingleSelectField(
      projectId,
      "Kind",
      Object.keys(KIND_LABELS).map((name) => ({
        name,
        color: KIND_FIELD_COLORS[name] ?? "GRAY",
        description: KIND_LABELS[name].description,
      })),
    );
    ({ fields, views } = listProjectFields(projectId));
  }

  const named = byName();
  if (!named.Status) {
    console.log("creating Status field…");
    createSingleSelectField(projectId, "Status", [
      { name: "Todo", color: "GRAY", description: "Planned" },
      { name: "In Progress", color: "YELLOW", description: "In progress" },
      { name: "Done", color: "GREEN", description: "Done" },
    ]);
    ({ fields, views } = listProjectFields(projectId));
  }

  const board = views.find((v) => v.layout === "BOARD_LAYOUT") ?? views[0];
  if (board && board.layout !== "BOARD_LAYOUT") {
    try {
      graphql(
        `mutation ($viewId: ID!) {
          updateProjectV2View(input: { viewId: $viewId, layout: BOARD_LAYOUT, name: "By wave" }) {
            projectV2View { id name layout }
          }
        }`,
        { viewId: board.id },
      );
    } catch (err) {
      console.warn(`warn: could not switch view to board: ${err.message}`);
    }
  }

  return listProjectFields(projectId).fields;
}

function optionId(field, names) {
  const wanted = Array.isArray(names) ? names : [names];
  const lower = wanted.map((n) => String(n).toLowerCase());
  const hit = (field.options ?? []).find((o) => lower.includes(o.name.toLowerCase()));
  return hit?.id ?? null;
}

function setSingleSelect(projectId, itemId, field, optionIdValue) {
  if (!field || !optionIdValue) return;
  graphql(
    `mutation ($projectId: ID!, $itemId: ID!, $fieldId: ID!, $optionId: String!) {
      updateProjectV2ItemFieldValue(input: {
        projectId: $projectId
        itemId: $itemId
        fieldId: $fieldId
        value: { singleSelectOptionId: $optionId }
      }) { projectV2Item { id } }
    }`,
    { projectId, itemId, fieldId: field.id, optionId: optionIdValue },
  );
}

function listRepoIssues(owner, repo) {
  return JSON.parse(
    gh([
      "issue",
      "list",
      "-R",
      `${owner}/${repo}`,
      "--state",
      "all",
      "--limit",
      "200",
      "--json",
      "number,title,state,url,labels",
    ]),
  );
}

function fetchIssue(owner, repo, number) {
  const data = graphql(
    `query ($owner: String!, $repo: String!, $number: Int!) {
      repository(owner: $owner, name: $repo) {
        issue(number: $number) {
          id databaseId number title url state
        }
      }
    }`,
    { owner, repo, number },
  );
  return data.repository.issue;
}

function createIssue(owner, repo, item, body) {
  const stdout = gh([
    "issue",
    "create",
    "-R",
    `${owner}/${repo}`,
    "--title",
    issueTitle(item),
    "--body",
    body,
    "--label",
    item.kind,
  ]);
  const url = stdout.trim().split("\n").filter(Boolean).at(-1);
  const match = url.match(/\/issues\/(\d+)/);
  if (!match) throw new Error(`could not parse issue number from: ${stdout}`);
  return fetchIssue(owner, repo, Number(match[1]));
}

function updateIssue(owner, repo, number, item, body) {
  gh([
    "issue",
    "edit",
    String(number),
    "-R",
    `${owner}/${repo}`,
    "--title",
    issueTitle(item),
    "--body",
    body,
  ]);
  gh([
    "api",
    "-X",
    "PATCH",
    `repos/${owner}/${repo}/issues/${number}`,
    "--input",
    "-",
  ], {
    input: JSON.stringify({ labels: [item.kind] }),
  });
  return fetchIssue(owner, repo, number);
}

function syncIssueState(owner, repo, issue, status) {
  const wantClosed = status === "done";
  const isClosed = issue.state === "CLOSED";
  if (wantClosed && !isClosed) {
    gh(["issue", "close", String(issue.number), "-R", `${owner}/${repo}`, "--comment", "Roadmap status is done."]);
  } else if (!wantClosed && isClosed) {
    gh(["issue", "reopen", String(issue.number), "-R", `${owner}/${repo}`]);
  }
}

function listProjectItems(projectId) {
  const items = [];
  let cursor = null;
  let hasNext = true;
  while (hasNext) {
    const data = graphql(
      `query ($id: ID!, $cursor: String) {
        node(id: $id) {
          ... on ProjectV2 {
            items(first: 50, after: $cursor) {
              pageInfo { hasNextPage endCursor }
              nodes {
                id
                content {
                  __typename
                  ... on Issue { number url }
                }
              }
            }
          }
        }
      }`,
      { id: projectId, cursor },
    );
    const conn = data.node.items;
    items.push(...conn.nodes);
    hasNext = conn.pageInfo.hasNextPage;
    cursor = conn.pageInfo.endCursor;
  }
  return items;
}

function addProjectItem(projectId, issueNodeId) {
  const data = graphql(
    `mutation ($projectId: ID!, $contentId: ID!) {
      addProjectV2ItemById(input: { projectId: $projectId, contentId: $contentId }) {
        item { id }
      }
    }`,
    { projectId, contentId: issueNodeId },
  );
  return data.addProjectV2ItemById.item.id;
}

function addBlockedBy(blockedIssueId, blockingIssueId) {
  graphql(
    `mutation ($issueId: ID!, $blockingIssueId: ID!) {
      addBlockedBy(input: { issueId: $issueId, blockingIssueId: $blockingIssueId }) {
        issue { number }
      }
    }`,
    { issueId: blockedIssueId, blockingIssueId },
  );
}

function rewriteRoadmap(roadmap, owner, repo, project, idToIssue) {
  roadmap.github = {
    owner,
    repo,
    projectTitle: PROJECT_TITLE,
    project: {
      number: project.number,
      url: project.url,
      id: project.id,
    },
  };
  roadmap.byIssue = {};
  for (const item of roadmap.items) {
    const issue = idToIssue.get(item.id);
    if (!issue) {
      item.githubIssue = null;
      continue;
    }
    item.githubIssue = { number: issue.number, url: issue.url };
    roadmap.byIssue[String(issue.number)] = item.id;
  }
  saveRoadmap(roadmap);
}

function main() {
  const repoInfo = resolveRepo();
  const { owner, repo } = repoInfo;
  console.log(`repo ${owner}/${repo}`);

  let visibility = repoInfo.visibility;
  if (!visibility) {
    try {
      visibility = JSON.parse(gh(["repo", "view", `${owner}/${repo}`, "--json", "visibility"])).visibility;
    } catch {
      visibility = "PUBLIC";
    }
  }
  const isPublic = String(visibility).toUpperCase() === "PUBLIC";

  const roadmap = loadRoadmap();
  if (!Array.isArray(roadmap.items)) {
    die("roadmap.json must have items[] (RM-NN), not stories[]");
  }

  try {
    gh(["auth", "status"]);
  } catch {
    die("gh is not authenticated. Run: gh auth login -s repo,project");
  }

  ensureLabels(owner, repo);
  const project = ensureProject(owner, repo, roadmap, isPublic);
  const fields = ensureFields(project.id, roadmap);
  const fieldByName = Object.fromEntries(fields.map((f) => [f.name, f]));
  const waveField = fieldByName.Wave;
  const kindField = fieldByName.Kind;
  const statusField = fieldByName.Status;

  const existingIssues = listRepoIssues(owner, repo);
  const byTitlePrefix = new Map();
  for (const issue of existingIssues) {
    const id = issue.title.split(TITLE_SEP)[0];
    if (/^RM-\d+$/.test(id) && !byTitlePrefix.has(id)) byTitlePrefix.set(id, issue);
  }

  const idToIssue = new Map();

  for (const item of roadmap.items) {
    let issue = null;
    const storedNumber = item.githubIssue?.number;
    if (storedNumber) {
      try {
        issue = fetchIssue(owner, repo, storedNumber);
      } catch {
        issue = null;
      }
    }
    if (!issue && byTitlePrefix.has(item.id)) {
      issue = fetchIssue(owner, repo, byTitlePrefix.get(item.id).number);
    }

    const body = markdownBody(item, roadmap, idToIssue);
    if (issue) {
      console.log(`updating ${item.id} → #${issue.number}`);
      issue = updateIssue(owner, repo, issue.number, item, body);
    } else {
      console.log(`creating ${item.id}…`);
      issue = createIssue(owner, repo, item, markdownBody(item, roadmap, idToIssue));
    }
    syncIssueState(owner, repo, issue, item.status);
    issue = fetchIssue(owner, repo, issue.number);
    idToIssue.set(item.id, issue);
    rewriteRoadmap(roadmap, owner, repo, project, idToIssue);
  }

  // Second pass: bodies now include real #N dependency links.
  for (const item of roadmap.items) {
    const issue = idToIssue.get(item.id);
    const body = markdownBody(item, roadmap, idToIssue);
    updateIssue(owner, repo, issue.number, item, body);
  }

  const projectItems = listProjectItems(project.id);
  const itemIdByIssueNumber = new Map();
  for (const node of projectItems) {
    if (node.content?.__typename === "Issue") {
      itemIdByIssueNumber.set(node.content.number, node.id);
    }
  }

  for (const item of roadmap.items) {
    const issue = idToIssue.get(item.id);
    let projectItemId = itemIdByIssueNumber.get(issue.number);
    if (!projectItemId) {
      projectItemId = addProjectItem(project.id, issue.id);
      itemIdByIssueNumber.set(issue.number, projectItemId);
    }

    const waveOpt = optionId(waveField, waveOptionName(roadmap, item.wave));
    const kindOpt = optionId(kindField, item.kind);
    const statusKey = item.status === "done" ? "done" : item.status === "in_progress" ? "in_progress" : "planned";
    const statusOpt = optionId(statusField, STATUS_OPTIONS[statusKey]);

    setSingleSelect(project.id, projectItemId, waveField, waveOpt);
    setSingleSelect(project.id, projectItemId, kindField, kindOpt);
    setSingleSelect(project.id, projectItemId, statusField, statusOpt);
  }

  let depsOk = 0;
  let depsSkip = 0;
  for (const item of roadmap.items) {
    const blocked = idToIssue.get(item.id);
    for (const depId of item.dependsOn ?? []) {
      const blocking = idToIssue.get(depId);
      if (!blocked || !blocking) continue;
      try {
        addBlockedBy(blocked.id, blocking.id);
        depsOk += 1;
      } catch (err) {
        const msg = err.message || "";
        if (/already|duplicate|exists/i.test(msg)) {
          depsOk += 1;
        } else {
          depsSkip += 1;
          console.warn(`warn: blocked-by ${item.id} ← ${depId}: ${msg}`);
        }
      }
    }
  }

  rewriteRoadmap(roadmap, owner, repo, project, idToIssue);

  const done = roadmap.items.filter((i) => i.status === "done").length;
  const planned = roadmap.items.filter((i) => i.status === "planned").length;
  const inProgress = roadmap.items.filter((i) => i.status === "in_progress").length;

  console.log("");
  console.log(`project  ${project.url}`);
  console.log(`issues   ${roadmap.items.length}  (done ${done}, planned ${planned}, in_progress ${inProgress})`);
  console.log(`deps     ${depsOk} set, ${depsSkip} skipped`);
  console.log(`wrote    ${ROADMAP_PATH}`);
  console.log("");
  console.log("Group the board by Wave in the GitHub UI (View → Group by → Wave).");
  console.log("Next PRs must use Closes #<issue-number>, not RM-NN alone.");
}

try {
  main();
} catch (err) {
  die(err.message);
}
