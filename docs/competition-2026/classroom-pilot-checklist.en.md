# Classroom pilot checklist (English)

**Status:** preparation checklist only. No students or teachers are reported as recruited, consented, or tested. Do not fill this document with assumed observations. The school and participating teacher must approve the protocol before any human session.

## 1. Before inviting anyone

- [ ] Confirm school approval, student eligibility, platform reuse rights, and the exact purpose of the pilot.
- [ ] Have the school determine age-appropriate student assent and parent/guardian consent requirements. Participation is voluntary; declining or stopping has no effect on grades or access to class activities.
- [ ] Name the school data owner. Agree on what is recorded, who can access it, how long it is kept, how participants can withdraw, and how records are deleted.
- [ ] Freeze the candidate build and record its local version/commit, test date, browser/device, and locale. Do not mix results from different builds without marking the change.
- [ ] Prepare fictional, pre-approved tasks and sources. Use personal or school evidence only when the school has expressly approved the material and the AI-provider transfer.
- [ ] Confirm that the test account and class are isolated from real classroom records. Use synthetic names and content for setup rehearsal.
- [ ] Verify account permissions, review/publish controls, error recovery, and the privacy boundaries before inviting participants.
- [ ] If any required approval, consent, permission, or safe test fixture is missing, do not recruit or begin a human session.

## 2. Roles

**Facilitating teacher:** explains the activity without coaching answers, checks that consent is in place, watches for discomfort or disclosure, records non-identifying observations, reviews the student's submission, and decides whether any content may be included in a private test archive. The teacher does not promise AI accuracy or learning improvement.

**Student participant:** may ask questions, skip any task, decline AI use, or stop at any time. The student describes their own role, selects only permitted sources, checks any AI suggestion, and decides whether to adopt, edit, or reject it with their own reason.

**Observer/researcher:** records task outcomes and timings using a random participant ID. The observer does not collect names, login details, raw private evidence, or credentials in the research sheet. Do not record a screen, face, or voice unless the separate recording permission is explicit.

## 3. Student task sequence

Use the same instructions and time limits for every participant. Do not coach a preferred answer.

1. Open `/competition-demo`, confirm the interface is in English, and read the learning goals and fixed practice examples. Remind the participant that those examples are fictional, not live AI output.
2. Follow the existing sign-in and class invitation process using the approved test account. Record whether the participant can distinguish the public orientation page from the signed-in workspace.
3. In the approved test card, describe a specific experience, personal contribution, action, result, and reflection. Use only the pre-approved task material.
4. Review the AI request preview. Ask the participant to identify which fields and sources will be sent; include at least one source that is not selected. Do not ask them to enter personal data to test this boundary.
5. Request a suggestion only if model use has been approved for this session. Record the actual response, provider/model, prompt version, run ID, and any failure in the protected technical log. Do not call a fallback, fixed card, or replay a live response.
6. Ask the participant to identify a claim, name the source they checked, describe anything missing or overstated, and choose to accept, edit, or reject the suggestion. Record the decision category and a de-identified observation, not a verbatim private explanation.
7. Save and submit the card. The teacher reviews the claims and gives feedback. Do not approve a claim solely because AI cited a source.
8. If public display is part of the approved test, first verify the exact release contents and receive the required publication permissions. Otherwise, stop at the private review stage.

## 4. Teacher review and public-boundary task

- [ ] Find the student's submitted card and distinguish it from drafts or previously approved work.
- [ ] Check each factual claim against the source content actually reviewed; treat a URL-only item as unread.
- [ ] Return the card with a specific request if a claim is unsupported or unclear; verify the student can revise and resubmit.
- [ ] Before any release, inspect the public snapshot as a viewer. Confirm it excludes private source content, private teacher feedback, unapproved work, and AI decision history.
- [ ] Do not publish real student work during a pilot unless the school has approved publication and the required permissions are recorded.

## 5. Observation record (blank template)

Create one row per task. Use a random study ID; keep any re-identification key separately under school control, if one is required. Do not paste source text or credentials here.

| Field | Record |
|---|---|
| Participant ID | [random code only] |
| Role | [student / teacher / observer] |
| Consent/approval verified by school | [yes / no — if no, stop] |
| Candidate build and date | [TODO] |
| Device/browser/viewport | [TODO] |
| Locale | [TODO] |
| Task ID and condition/order | [TODO] |
| Start/end time and elapsed minutes | [TODO] |
| Task completed | [yes / no / participant stopped] |
| Evidence preview understood | [yes / partly / no; record observed behavior] |
| Unselected source remained unselected | [yes / no / not tested] |
| Claim support judgment | [supported / partly supported / unsupported / not checkable] |
| Student action | [adopted / edited / rejected / no suggestion / declined AI] |
| Issue or error category | [TODO; no identifying content] |
| Run ID/provider/model/prompt version | [TODO if a live request occurred] |
| Teacher review outcome | [TODO] |
| Protocol deviation or stop reason | [TODO] |

Do not convert empty fields to zero, “pass,” or “no issue.” Record missing observations as missing and keep failed AI requests in the denominator.

## 6. Stop conditions

Stop the session immediately if consent or approval cannot be verified, a participant asks to stop, a participant appears distressed, personal/identifiable or unauthorized source content is entered or sent, a public/private boundary appears broken, another participant's information is exposed, or the candidate differs from the approved build. Do not retry by re-entering sensitive data. Notify the named school data owner and follow the school's incident and deletion procedure. Record only a non-identifying stop category in the shared observation sheet.

Also pause the study if the AI provider/model or prompt version is unknown, if the model generates an unsupported or harmful claim that the participant could reasonably mistake for verified fact, or if the app cannot recover safely from an error. Preserve the run ID and approved synthetic test record for review; do not publish the response as an endorsement of model quality.

## 7. Reporting boundary

Before data collection, finalize the approved sample and analysis plan. Report actual counts, denominators, missing cases, failures, and deviations. Distinguish a technical synthetic-case test from a human classroom pilot. A small pilot is descriptive and cannot establish general or causal learning effects. Until a school-approved study is completed and reviewed, report: **“No classroom pilot results are available.”**
