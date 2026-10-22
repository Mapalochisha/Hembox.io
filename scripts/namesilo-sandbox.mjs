#!/usr/bin/env node

import { createNameSiloSandboxOperations } from "../src/lib/domains/providers/namesilo-sandbox-operations.ts"

const [command, ...providedArgs] = process.argv.slice(2)
const hasConfirmation = providedArgs.includes("--confirm-ote-only")
const args = providedArgs.filter((value) => value !== "--confirm-ote-only")
const [domain, ...rest] = args
const api = createNameSiloSandboxOperations()

function usage() {
  console.error(`NameSilo OTE sandbox tools (never targets production)

Usage:
  npm run namesilo:ote -- account
  npm run namesilo:ote -- list
  npm run namesilo:ote -- info <domain.com|domain.net>
  npm run namesilo:ote -- availability <domain.com|domain.net> [another-domain.net ...]
  npm run namesilo:ote -- register <domain.com|domain.net> <years> --confirm-ote-only
  npm run namesilo:ote -- renew <domain.com|domain.net> <years> --confirm-ote-only
  npm run namesilo:ote -- nameservers <domain.com|domain.net> <ns1.namesilo.com> <ns2.namesilo.com> [more NS1–NS8 hosts] --confirm-ote-only

Transfers are intentionally omitted from this CLI so EPP authorization codes are not passed as command-line arguments or saved to shell history.
Mutating commands spend sandbox account funds as applicable and can reserve/change a shared OTE domain. Do not run one unless you have intentionally selected a disposable test domain.`)
}

function printJson(value) {
  console.log(JSON.stringify(value, null, 2))
}

async function main() {
  if (!command || command === "help" || command === "--help") {
    usage()
    process.exitCode = command ? 0 : 2
    return
  }

  // Read-only account probes: they do not reference a domain and are the
  // safest way to prove the OTE key/account work. getDomainInfo is
  // account-scoped, so run `list` before concluding anything from `info`.
  if (command === "account") {
    if (args.length) throw new Error("account takes no arguments.")
    const balance = await api.getAccountBalance()
    printJson(balance)
    if (balance.balance === null) process.exitCode = 2
    return
  }

  if (command === "list") {
    if (args.length) throw new Error("list takes no arguments.")
    const list = await api.listDomains()
    printJson(list)
    if (list.providerCode !== 300) process.exitCode = 2
    return
  }

  if (!domain) throw new Error("A .com or .net domain is required.")

  if (command === "info") {
    if (rest.length) throw new Error("info accepts exactly one domain.")
    const info = await api.getDomainInfo(domain)
    printJson(info)
    if (info.state === "unknown") process.exitCode = 2
    return
  }

  if (command === "availability") {
    const results = await api.checkAvailability([domain, ...rest])
    printJson(results)
    if (results.some((item) => item.availability === "unknown")) process.exitCode = 2
    return
  }

  if (!["register", "renew", "nameservers"].includes(command)) {
    usage()
    throw new Error(`Unsupported command: ${command}`)
  }
  if (!hasConfirmation) {
    throw new Error('Mutating sandbox commands require the explicit flag "--confirm-ote-only".')
  }

  let outcome
  if (command === "register" || command === "renew") {
    if (rest.length !== 1) throw new Error(`${command} requires exactly one years argument.`)
    const years = Number(rest[0])
    outcome = command === "register"
      ? await api.registerDomain({ confirmSandboxOnly: "OTE_ONLY", domain, years })
      : await api.renewDomain({ confirmSandboxOnly: "OTE_ONLY", domain, years })
  } else {
    if (rest.length < 2) throw new Error("nameservers requires at least two nameserver values.")
    outcome = await api.changeNameServers({
      confirmSandboxOnly: "OTE_ONLY",
      domain,
      nameservers: rest,
    })
  }

  printJson({ outcome })
  if (outcome.reconciliationRequired) {
    console.log("\nRead-only domain-info reconciliation:")
    printJson(await api.getDomainInfo(domain))
  }
  if (outcome.state === "ambiguous") process.exitCode = 3
}

main().catch((error) => {
  // Never print a request URL or raw provider body: NameSilo puts its API key in the URL.
  console.error(error instanceof Error ? error.message : "NameSilo OTE command failed.")
  process.exitCode = 1
})
