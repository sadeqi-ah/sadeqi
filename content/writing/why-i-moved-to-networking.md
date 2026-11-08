---
title: Why I moved from frontend to networking
description: Years of React and Svelte, a lost LinkedIn account, and a decision to learn how the internet actually works — from the wire up.
date: "2026-11-07"
tags: [networking, life]
pinned: true
readingTime: 6
---

For years my job was pixels: forms, routes, state, and making things feel fast. At some point I realised the part I found most interesting was everything underneath — the requests, the hops, the reasons a page is slow before a single line of my code runs.

## The plan

No paid courses, no expensive certs (yet). Just labs, notes and code. Every lab gets a topology diagram, versioned configs and a post here.

```yaml [lab-01.clab.yml]
name: lab-01
topology:
  nodes:
    r1: { kind: linux, image: frrouting/frr }
    r2: { kind: linux, image: frrouting/frr }
  links:
    - endpoints: ["r1:eth1", "r2:eth1"]
```

::callout
The best way to learn a network is to break one you own.
::

::image-figure{caption="fig. 1 — the first topology: two FRR routers, one link"}
::

I will keep writing as I go. If you are hiring for network or NetDevOps roles — or just want to talk about consensus protocols — my inbox is open.
