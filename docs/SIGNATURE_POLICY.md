# Signature Policy — What the Pickup Signature Means, and Whether a Typed Name Is Valid

**Written:** 2026-08-31. Research conducted against primary sources (statute text,
official agency documents, first-party carrier tariffs/service guides); every claim
below carries its citation, and anything that could not be verified against a primary
source is flagged as such. Full URL list in [Sources](#sources).

## The question

E3 Package Manager is used by mailbox rental centers (Commercial Mail Receiving
Agencies, "CMRAs") to log package intake and pickup. At pickup, staff have the
customer sign on a canvas signature pad; the signature (base64 PNG) is stored with
the pickup event (`signatures` table, linked by `package_id`, with `signed_at`;
the pickup event also records `pickup_person_name`, `staff_initials`, and
`pickup_timestamp`). Accessibility item **H10** in [A11Y_AUDIT.md](A11Y_AUDIT.md)
notes the canvas is mouse/touch-only — the only complete keyboard blocker left in
the app — and proposes a typed-name fallback. The question this document settles:
**is a typed name a legally valid and practically sufficient alternative to a drawn
signature for this app's pickup record?**

**Answer, up front: yes** — with a short list of implementation requirements
(§ [Implementation requirements](#implementation-requirements-for-the-typed-name-fallback))
that make the typed record carry equal or better evidentiary weight than the
drawn one. The reasoning and evidence follow.

---

## 1. What a signature legally is

### The federal E-SIGN Act

The E-SIGN Act defines "electronic signature" at 15 U.S.C. §7006(5) as:

> "an electronic sound, symbol, or process, attached to or logically associated
> with a contract or other record and executed or adopted by a person with the
> intent to sign the record."

And 15 U.S.C. §7001(a) makes electronic signatures legally equivalent to any other:

> "(1) a signature, contract, or other record relating to such transaction may not
> be denied legal effect, validity, or enforceability solely because it is in
> electronic form; and (2) a contract relating to such transaction may not be
> denied legal effect, validity, or enforceability solely because an electronic
> signature or electronic record was used in its formation."

The statute says **nothing** about the visual form of a signature. "Drawn,"
"handwritten," "cursive," "typed" — none of these words appear. The definition is
functional: a *sound, symbol, or process* plus *intent to sign*, *attached to or
logically associated with* the record. (Verified against the full text of §§7001
and 7006 at Cornell LII.)

### UETA (the state-law analogue)

The Uniform Electronic Transactions Act (1999) §2(8) defines "electronic
signature" nearly identically:

> "'Electronic signature' means an electronic sound, symbol, or process attached
> to or logically associated with a record and executed or adopted by a person
> with the intent to sign the record."

UETA §7 (Legal Recognition):

> "(a) A record or signature may not be denied legal effect or enforceability
> solely because it is in electronic form. (b) A contract may not be denied legal
> effect or enforceability solely because an electronic record was used in its
> formation. (c) If a law requires a record to be in writing, an electronic
> record satisfies the law. (d) If a law requires a signature, an electronic
> signature satisfies the law."

The **official comment** to UETA §2 addresses typed names directly:

> "No specific technology need be used in order to create a valid signature.
> One's voice on an answering machine may suffice if the requisite intention is
> present. Similarly, including one's name as part of an electronic mail
> communication also may suffice, as may the firm name on a facsimile."

and:

> "In any case the critical element is the intention to execute or adopt the
> sound or symbol or process for the purpose of signing the related record."

(Quoted from the ULC's official 1999 final act with comments, cross-checked
against an independent mirror.)

**Adoption:** UETA has been enacted in 49 states plus D.C., Puerto Rico, and the
U.S. Virgin Islands; the two most recent adopters were verified directly against
state code — Washington (RCW ch. 1.80, effective June 11, 2020) and Illinois
(815 ILCS 333, effective June 25, 2021). New York is the lone holdout: it has its
own ESRA (N.Y. State Technology Law §§301–309), whose §302(3) definition of
"electronic signature" is word-for-word the E-SIGN definition, and whose §304(2)
provides that an electronic signature "shall have the same validity and effect as
the use of a signature affixed by hand." NY's official ESRA guideline
(NYS-G04-001) states the definition "conforms to the definition found in federal
law (the 'E-Sign' Act)." *Flag: the "49 + DC + PR + USVI" count comes from a
NYC Bar Association report (Jan. 2026) — the ULC's own enactment map is a
JavaScript widget that could not be scraped — but the count is corroborated by the
direct state-code verifications above.*

**Bottom line:** in every US jurisdiction, a typed name entered with intent to
sign, attached to the record, *is* a signature. The law cares about **intent +
attribution + association with the record**, not the shape of the glyph.

### Does a signature have to look like your "usual" signature? (Common-law doctrine)

No — and this predates electronics by centuries. UCC §1-201(b)(37):

> "'Signed' includes using any symbol executed or adopted with present intention
> to adopt or accept a writing."

The official comment to that definition (verified via the D.C. Code, which
publishes the UCC comments alongside the enacted text) says authentication may be

> "printed, stamped or written; it may be by initials or by thumbprint"

and

> "The question always is whether the symbol was executed or adopted by the party
> with present intention to adopt or accept the writing."

(The 2022 UCC amendments, enacted in many states, restate this media-neutrally:
"'Sign' … mean[s] with present intent to authenticate or adopt a record: To
execute or adopt a tangible symbol; or To attach to or logically associate with
the record an electronic symbol, sound, or process." — D.C. Code §28:1-201.)

Restatement (Second) of Contracts §134 states the same rule: the signature "may
be any symbol made or adopted with an intention, actual or apparent, to
authenticate the writing as that of the signer." *Flag: verified as quoted in a
published court opinion — In re Estate of Bixby, No. 2 CA-CV 2024-0366 (Ariz. Ct.
App. July 11, 2025), which held "XO" on a sticky note could satisfy a signature
requirement — not against the ALI's own text, which is paywalled.* An "X," a
mark, initials, a thumbprint, a stamp — all have long sufficed when adopted with
intent to authenticate.

Forensic handwriting comparison does exist — but as an **evidentiary** discipline
for contested documents, not a validity requirement. Federal Rule of Evidence
901(b)(2)–(3) lists, among ways to authenticate evidence, "[a] nonexpert's
opinion that handwriting is genuine, based on a familiarity with it that was not
acquired for the current litigation" and "[a] comparison with an authenticated
specimen by an expert witness or the trier of fact." That is where signature
matching lives: litigation over a disputed document, not the moment of signing.

---

## 2. Does anyone actually check whether a signature "matches"?

The user's core question — "do companies study signatures to see if what was
collected was actually from the claimed person?" — has a clear answer:
**essentially never, outside two narrow regimes.** Four contexts:

### (a) Routine delivery proof-of-delivery: no verification, ever

No carrier tariff or service guide requires comparing a delivery signature to any
reference. The signature's stated function is to *create a record*:

- **FedEx Service Guide (2025), Definitions:** "'Proof of delivery' means
  electronically captured delivery information, which **may** include date, time,
  location, and signature information." A signature is optional even within the
  definition of POD.
- **FedEx, Indirect Signature Required:** FedEx will take the signature "[f]rom
  someone at the delivery address; or … [f]rom a neighbor, building manager, or
  other person at a neighboring address." The signer need not be the addressee
  at all. Residential shipments "may be released without obtaining a signature"
  by default; shipments released without signature appear in the "Liabilities
  Not Assumed" list (risk shifts, no verification implied).
- **UPS Tariff/Terms (2024 ed.), §28 Shipper Release:** "a signature will not be
  obtained upon Delivery, and a UPS Delivery record showing a completed Shipper
  Release delivery shall be **conclusive proof that Delivery was completed**."
  UPS's contractual definition of "Delivery" includes "delivery to the
  Consignee or the Consignee's actual or apparent agent" and delivery "to any
  person present at such address."
- **USPS DMM 503.8.1.1:** "Signature Confirmation provides the mailer with
  information about the date and time an article was delivered … A delivery
  record (including a signature) is maintained by USPS." DMM 508.1.4.1: "an
  addressee's mail may be delivered to an employee, to a competent member of the
  addressee's family, or to any person authorized to represent the addressee."
  DMM 503.1.8 even allows a **pre-filed** electronic signature to be substituted
  for a live one for certain services.

The COVID-19 era made the point explicit — the carriers themselves swapped the
scrawl for a name:

- **UPS** (first-party PDF still on ups.com): "the UPS driver will validate and
  record the **name** of the recipient of the package **in lieu of obtaining a
  signature**."
- **USPS** (official USPS Link newsroom, Mar. 27, 2020): "The carrier should then
  ask the customer for his or her **first initial and last name** and enter this
  information in the carrier's Mobile Delivery Device," with the carrier printing
  their own initials and "C19" instead of a customer signature.
- **FedEx**: "Customers may … be asked to verify recipient name in lieu of a
  physical signature." *Flag: verified on a live fedex.com regional page (en-vi);
  the retired US-locale page is archived but could not be fetched (rate-limited).*

For years, a typed/written name **was** the proof-of-delivery record for the
world's largest carriers. Nobody's insurance collapsed. The value of the POD
signature is the record and the ceremony — who, when, where — plus its metadata;
it is compared against nothing. *(Labeled inference from absence: no provision
requiring comparison exists to find in the DMM or the carrier terms reviewed.)*

### (b) Banking and checks: the UCC blesses *not* looking

The one commercial setting with genuine signature duties is checks — and even
there, the UCC's own text acknowledges banks process by machine. UCC §3-103(a)(9),
defining "ordinary care":

> "In the case of a bank that takes an instrument for processing for collection
> or payment by automated means, reasonable commercial standards **do not
> require the bank to examine the instrument** if the failure to examine does not
> violate the bank's prescribed procedures and the bank's procedures do not vary
> unreasonably from general banking usage…"

And §4-406(c) puts the front-line duty on the *customer*, who "must exercise
reasonable promptness in examining the statement or the items to determine
whether any payment was not authorized," with an absolute one-year bar
(§4-406(f)) on claiming an unauthorized signature after that. §3-403(a) makes an
unauthorized signature ineffective as the purported signer's — the remedy is
after-the-fact allocation of loss, not front-end verification. *Flag: the
empirical claim "banks rarely hand-compare signatures today" has no statute to
cite; §3-103(a)(9) is the statute-level acknowledgment of exactly that practice.*

### (c) Notarization: identity is proofed, the signature is not compared

A notary verifies **who you are**, never what your signature looks like.
California Civil Code §1185(a): the officer must have "satisfactory evidence
that the person making the acknowledgment is the individual who is described in
and who executed the instrument" — defined in §1185(b) as credible witnesses or
government-issued photo ID. Colorado's enacted RULONA (C.R.S. §24-21-507) is the
same: personal knowledge, ID documents, or a credible witness. Signature
comparison appears nowhere in either statute.

Better still: a person who cannot write may sign **by mark**. California Civil
Code §14: "signature or subscription includes mark, when the person cannot
write," witnessed by two persons. The California Secretary of State's Notary
Public Handbook (2026 ed., pp. 16–17) walks through notarizing an "X," noting
"[t]he witnesses are only verifying that they witnessed the individual make
their mark on the document." And C.R.S. §24-21-509(1): a person "physically
unable to sign" may "direct an individual other than the notarial officer to
sign the individual's name on the record." A witnessed "X" — or someone else's
hand entirely — is a fully notarizable signature. Notarization authenticates the
*person and the act*, not the handwriting.

### (d) Vote-by-mail: the one real matching regime — the exception that proves the rule

Mail-ballot signature verification is the only mass regime in American life that
compares signatures to a reference — and look what it takes. California Elections
Code §3019(a)(1) requires officials to "compare the signature on the
identification envelope" with the registration signature; §3019(c) requires that
a flagged signature be rejected "only if two additional elections officials each
find **beyond a reasonable doubt** that the signature differs in multiple,
significant, and obvious respects from all signatures in the voter's registration
record," and §3019(d) mandates notice-and-cure. Colorado (C.R.S. §1-7.5-107.3)
similarly requires a reference database, bipartisan multi-judge review of
mismatches, a cure affidavit, and referral to the district attorney. *(Flag: the
Colorado statute was quoted from FindLaw's reproduction of the CRS; official
copies returned HTTP 403.)*

When the law actually wants signature comparison, it must say so expressly, build
a reference exemplar database, stack presumptions toward validity, and bolt on
multi-official review and cure. **None of that exists anywhere near package
delivery.**

---

## 3. What THIS app's signature actually is

### The CMRA agency chain

Under the USPS Domestic Mail Manual, a mailbox store is the customer's **agent**,
and delivery legally completes at the store:

- **DMM 508.1.8.1:** "A Commercial Mail Receiving Agency (CMRA) is defined as a
  business that, in whole or in part, accepts the delivery of U.S. Mail **on
  behalf of another person or entity** as a business service."
- **DMM 508.1.8.2:** "An addressee may request mail delivery to a CMRA. The CMRA
  accepts delivery of the mail and holds it for pickup or remails it to the
  addressee…" — USPS's involvement ends at the CMRA's counter; pickup is the
  CMRA's own business service.
- **PS Form 1583** — literally titled "**Application for Delivery of Mail Through
  Agent**" (June 2024 ed.; the form's own definitions: "Agent: The Commercial
  Mail Receiving Agency (CMRA)") — is how the customer authorizes that agency
  (DMM 508.1.8.3, including the 2023 ID-verification and CRD-database
  requirements per Postal Bulletin 22624).
- **DMM 508.1.1.7:** "USPS responsibility ends when the mailpiece is delivered to
  the addressee (or another party, subject to 1.0)."

*(The DMM never uses the literal sentence "delivery to the CMRA constitutes
delivery to the addressee"; the rule is the composite of the three provisions
above, quoted verbatim.)*

Crucially, **the full current text of DMM 508.1.8 (1.8.1–1.8.4) was read, and
nothing in it — or elsewhere in DMM 503/508 — prescribes how a CMRA documents,
receipts, or verifies handing a package to its own customer.** Every requirement
in 508.1.8 concerns CMRA registration with USPS, the customer's Form 1583, and
termination/remail mechanics. The DMM itself points to the private contract:
508.1.8.4 references "an internal service agreement between the customer and
CMRA." The same is true on the private-carrier side: UPS/FedEx parcels are not
U.S. Mail, but the carriers' own terms complete "Delivery" at the store (UPS:
"delivery to the Consignee or the Consignee's actual or apparent agent or
representative"; FedEx obtains any required signature "from someone at the
delivery address" — the store) and impose nothing on what the receiving agent
does afterward.

### So the pickup signature is an internal record — nothing more, nothing less

The signature this app captures is **not** a USPS requirement, not a carrier
requirement, and not anyone's proof-of-delivery obligation. It is a private
business record between the store and its customer, governed by the mailbox
service agreement. What it protects against is exactly one scenario: a dispute
between the store and a customer — *"someone picked up my package"* / *"you
never gave me my package."* Its evidentiary job is to show **that a specific
person acknowledged receiving specific packages at a specific time, witnessed by
a specific staff member.** The app already records almost all of this:
`pickup_person_name`, `staff_initials`, `pickup_timestamp`,
`signature_required`/`signature_captured`, and the per-package linkage
(`signatures.package_id`, `signed_at`).

Nobody will ever compare the stored PNG scrawl against a reference exemplar
(§2 above — no such regime exists here, and the store holds no exemplar to
compare against anyway). In a genuinely contested case, the record's strength
comes from its **metadata and the staff witness** — which, under FRE 901(b)(1),
is how such a record would actually be authenticated: testimony of a witness
with knowledge, not handwriting analysis of a mouse squiggle.

---

## 4. The decision: is a typed name good enough here?

**Yes. A typed name, captured with an explicit intent action and the metadata the
app already records, is a fully valid signature and an adequate — arguably
superior — record for this app's purpose.** Recommendation: implement the H10
typed-name fallback as a first-class signature method alongside the canvas.

Reasoning:

1. **Legally equivalent everywhere.** E-SIGN §7006(5)/§7001(a) and UETA
   §2(8)/§7 (49 states + DC) and NY ESRA §§302(3)/304(2) all define signature
   functionally — symbol/process + intent + association — with zero requirements
   on visual form. The UETA official comment expressly blesses a typed name.
   Common-law doctrine (UCC §1-201(b)(37) and comment; Restatement §134) has
   accepted marks, initials, and stamps for centuries.
2. **Attribution comes from context, not the glyph.** UETA §9(a) (verified in
   Minnesota's and California's enacted texts): "An electronic record or
   electronic signature is attributable to a person if it was the act of the
   person. The act of the person may be shown **in any manner**…" This app's
   attribution story — staff member physically present, witnessing the customer,
   recording who/when/which packages — is *stronger* than most e-signature flows,
   and is identical for a typed name and a drawn one.
3. **Nobody verifies delivery signatures**, and the carriers themselves ran on
   recorded names instead of signatures during COVID (UPS, USPS, FedEx — §2(a)).
   A mouse-drawn scrawl on a canvas has no verification value a typed name
   lacks.
4. **The record is internal.** No USPS, DMM, or carrier rule constrains it
   (§3). The mailbox service agreement governs; the store may accept any
   signature form it chooses.
5. **The ADA points the same direction.** A mailbox store is a place of public
   accommodation (42 U.S.C. §12181(7)(F), "…or other service establishment" —
   the application of the catch-all to a mailbox store is interpretation, but a
   comfortable one; it sits in the same list as banks and travel services).
   Title III requires "reasonable modifications in policies, practices, or
   procedures" when necessary for individuals with disabilities (42 U.S.C.
   §12182(b)(2)(A)(ii); 28 C.F.R. §36.302(a)). A drawn-only requirement excludes
   not just keyboard-only operators but customers with tremor, limb difference,
   or paralysis — the very population signature-by-mark statutes (Cal. Civ. Code
   §14) and SSA alternative-signature policy (POMS GN 00201.015: click-and-sign,
   attestation, etc.) exist to serve. A typed-name option is about the cheapest
   "readily achievable" modification imaginable. *(The motor-disability framing
   is reasoning supported by those statutes' existence, not a quoted DOJ
   finding; no DOJ guidance specifically on signature alternatives was located.)*
6. **WCAG 2.1.1, read honestly.** SC 2.1.1 exempts functionality "where the
   underlying function requires input that depends on the path of the user's
   movement," and W3C's Understanding doc names "[f]ree hand drawing" as
   path-dependent — so the canvas *itself* arguably doesn't fail. But the
   normative Note 1 cuts the other way: "This exception relates to the
   **underlying function**, not the input technique. For example, if using
   handwriting to enter text, the input technique (handwriting) requires
   path-dependent input but the underlying function (text input) does not." The
   underlying function here is *recording assent to receipt* — which a typed
   name accomplishes — so offering only the drawing forecloses a function that
   is not inherently path-dependent. The typed fallback satisfies both the
   letter and the intent of 2.1.1, and closes H10.
7. **Industry norm.** DocuSign's standard signature-adoption flow offers typed
   (the *default*, auto-styled from the signer's name), drawn, and uploaded
   signatures, backed by a certificate-of-completion audit trail (first-party
   DocuSign pages, fetched). *Flag: Adobe Acrobat Sign documents the same
   Type/Draw/Image options at helpx.adobe.com, but those pages timed out on
   every direct fetch — known only via search snippets; treat as unverified.*

**One honest counterpoint, so it's on the record:** a drawn signature preserves a
theoretical litigation avenue a typed name does not — expert handwriting
comparison under FRE 901(b)(3) requires a drawn exemplar. For this app that
avenue is close to worthless (a mouse/finger scrawl is a poor exemplar; the
store holds no reference to compare against; and the realistic authentication
path is staff-witness testimony plus metadata), but it is the one thing given
up. The mitigation is simple: keep the drawn pad as the default and offer typed
as the alternative — which is also exactly the DocuSign-style industry pattern,
and preserves the small ceremonial/deterrent weight of the act of signing either
way (the "ceremony" — an explicit, deliberate signing act — is what the UETA
comment identifies as the critical element, and a typed flow can have exactly as
much of it).

---

## 5. Implementation requirements for the typed-name fallback

For the typed record to carry equal (or better) evidentiary weight, the
implementation must capture the three statutory elements — **intent,
attribution, association** — plus E-SIGN-compliant retention. Concretely:

1. **Explicit intent action (E-SIGN §7006(5)/UETA §2(8) "intent to sign";
   UETA §2 cmt. — the click-through model).** Typing the name alone is not the
   signature; the *adoption* of it is. The UI must pair the typed name with a
   clearly labeled affirmative act, e.g. type full name → button labeled
   **"Sign & Confirm Pickup"** with adjacent text: *"By typing my name and
   confirming, I acknowledge receipt of the package(s) listed above."* Enter in
   the name field may activate the confirm button; it must never auto-sign.
2. **Record the signature method.** Add a `signature_method` field
   (`'drawn' | 'typed'`) to the `signatures` table and surface it in
   SignatureRetrieval. The record should honestly reflect how it was captured —
   do not render the typed name in a cursive font *in place of* the truth. (If a
   rendered image is generated for display parity, store the raw typed string
   too; the text is the signature, the image is a view of it.)
3. **Store the typed name as text**, alongside (not instead of) the pickup
   event's `pickup_person_name`. The two should normally match; a mismatch is
   itself useful signal in a dispute.
4. **Attribution context (UETA §9(a): the act "may be shown in any manner").**
   Already largely in place — keep capturing `staff_initials` (the live
   witness), `pickup_timestamp`, and `signed_at`. The staff witness is this
   app's strongest attribution evidence for *both* methods; store policy (e.g.,
   ID check for unfamiliar pickup persons) does the identity-proofing work, just
   as it does for notaries (§2(c)) — the signature never did.
5. **Association with the record (the "attached to or logically associated"
   element).** Already satisfied: `signatures.package_id` ties the signature to
   specific packages, and the pickup event ties in mailbox/tenant/tracking
   numbers. Preserve this linkage for typed signatures identically — one
   signature row per package, same as drawn.
6. **Retention per 15 U.S.C. §7001(d)(1):** the retained record must
   "accurately reflect[] the information," "remain[] accessible to all persons
   who are entitled to access," and be "capable of being accurately reproduced
   for later reference, whether by transmission, printing, or otherwise."
   Practically: signature rows and pickup events are append-only (never edit a
   captured signature or its metadata; corrections are new records), and
   SignatureRetrieval's export/print path must work for typed records too.
   *(Cryptographic tamper-proofing — hashes, signed audit logs — is the
   DocuSign-style industry pattern, not a statutory requirement; worth doing if
   cheap, but flagged as best practice, not law.)*
7. **The fallback itself must be accessible:** a labeled text input, fully
   keyboard-operable, announced state changes — per the patterns already
   established in the H1–H9 fixes. Offer the choice as "Draw" / "Type" (drawn
   remains the default), mirroring the industry pattern.

Items 4 and 5 are already implemented today; the new work is items 1–3, 6
(append-only discipline + export parity), and 7.

---

## Sources

Primary sources fetched and quoted (grouped by section). General caveat: most web
quotes were fetched through a summarizing fetcher instructed to return verbatim
text; the UETA official text, UPS tariff, FedEx Service Guide, PS Form 1583,
Colorado RULONA, CA Notary Handbook, DMM 503/508, and two court/agency PDFs were
downloaded and text-extracted directly (highest fidelity).

**Statutes — e-signature law**
- E-SIGN Act, 15 U.S.C. §7001 — <https://www.law.cornell.edu/uscode/text/15/7001>
- E-SIGN Act, 15 U.S.C. §7006 (definitions) — <https://www.law.cornell.edu/uscode/text/15/7006>
- UETA (1999), official text with prefatory note and comments (ULC) — <https://www.uniformlaws.org/committees/community-home?CommunityKey=2c04b76c-2b7d-4399-977e-d5876ba7e034> (final-act PDF; cross-checked at <https://euro.ecom.cmu.edu/program/law/08-732/Transactions/ueta.pdf>)
- Washington UETA, RCW ch. 1.80 (2020) — <https://app.leg.wa.gov/RCW/default.aspx?cite=1.80&full=true>
- Illinois UETA, 815 ILCS 333 (2021) — <https://www.ilga.gov/Legislation/ILCS/Articles?ActID=4165&ChapterID=67>
- NY ESRA, N.Y. State Tech. Law §302 — <https://www.nysenate.gov/legislation/laws/STT/302>; §304 — <https://www.nysenate.gov/legislation/laws/STT/304>; NYS ITS ESRA guideline — <https://its.ny.gov/electronic-signatures-and-records-act-esra>
- NYC Bar Ass'n, *Modernizing New York's Electronic Signatures Law* (Jan. 2026) — <https://www.nycbar.org/reports/modernizing-new-york-electronic-signatures-esra-ueta/> *(secondary; used only for the adoption count)*
- UETA §9 as enacted: Minn. Stat. §325L.09 — <https://www.revisor.mn.gov/statutes/cite/325L.09>; Cal. Civ. Code §1633.9 — <https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=CIV&sectionNum=1633.9.>

**Signature doctrine**
- UCC §1-201(b)(37) — <https://www.law.cornell.edu/ucc/1/1-201>
- D.C. Code §28:1-201 (2022-amendment text + official comment) — <https://code.dccouncil.gov/us/dc/council/code/sections/28:1-201>
- *In re Estate of Bixby*, No. 2 CA-CV 2024-0366 (Ariz. Ct. App. 2025) (quoting Restatement (Second) of Contracts §134) — <https://www.appeals2.az.gov/Decisions/CV20240366Opinion.pdf>
- Fed. R. Evid. 901 — <https://www.law.cornell.edu/rules/fre/rule_901>

**Who verifies signatures**
- UCC §3-103 ("ordinary care") — <https://www.law.cornell.edu/ucc/3/3-103>; §3-403 — <https://www.law.cornell.edu/ucc/3/3-403>; §4-406 — <https://www.law.cornell.edu/ucc/4/4-406>; Cal. Com. Code §4406 — <https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=COM&sectionNum=4406>
- Cal. Civ. Code §1185 (notary identity) — <https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=CIV&sectionNum=1185>; §14 (signature by mark) — <https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=CIV&sectionNum=14>
- Colorado RULONA, C.R.S. §§24-21-507, -509 — <https://www.coloradosos.gov/pubs/info_center/laws/RULONA.pdf>
- California SOS Notary Public Handbook (2026) — <https://notary.cdn.sos.ca.gov/forms/notary-handbook-current.pdf>
- Cal. Elec. Code §3019 (vote-by-mail matching) — <https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=ELEC&sectionNum=3019>
- C.R.S. §1-7.5-107.3 — <https://codes.findlaw.com/co/title-1-elections/co-rev-st-sect-1-7-5-107-3/> *(unofficial reproduction; official copies returned 403)*

**Carriers and USPS**
- UPS Tariff/Terms and Conditions of Service — US (2024 ed., eff. Dec. 26, 2023) — <https://www.ups.com/assets/resources/webcontent/en_US/terms-service-us.pdf> *(2026 edition exists but timed out on fetch)*
- UPS, "Temporary Adjustment to Signature Required Guidelines" (COVID) — <https://www.ups.com/assets/resources/webcontent/en_US/signature_required_guidelines.pdf>
- FedEx Service Guide (eff. Jan. 6, 2025; updated Sept. 22, 2025) — <https://www.fedex.com/content/dam/fedex/us-united-states/services/Service_Guide_2025.pdf>; 2021 terms cross-check — <https://www.fedex.com/content/dam/fedex/us-united-states/services/SG_TermsCond_US_2021.pdf>
- FedEx COVID signature suspension — <https://www.fedex.com/en-vi/coronavirus.html> *(regional page; retired US page archived but unfetchable)*
- USPS DMM 503 (Extra Services) — <https://pe.usps.com/text/dmm300/503.htm>
- USPS DMM 508 (Recipient Services, incl. 1.8 CMRA) — <https://pe.usps.com/text/dmm300/508.htm>
- USPS Link, "Sign of the times" (Mar. 27, 2020, COVID delivery procedure) — <https://news.usps.com/2020/03/27/sign-of-the-times-3/>
- PS Form 1583 (June 2024) — <https://about.usps.com/forms/ps1583.pdf>
- Postal Bulletin 22624 (May 18, 2023), CMRA DMM revision — <https://about.usps.com/postal-bulletin/2023/pb22624/html/updt_002.htm>

**Accessibility**
- 42 U.S.C. §12181 — <https://www.law.cornell.edu/uscode/text/42/12181>; §12182 — <https://www.law.cornell.edu/uscode/text/42/12182>; 28 C.F.R. §36.302 — <https://www.law.cornell.edu/cfr/text/28/36.302>
- WCAG 2.1 SC 2.1.1 — <https://www.w3.org/TR/WCAG21/#keyboard>; Understanding 2.1.1 — <https://www.w3.org/WAI/WCAG21/Understanding/keyboard.html>
- SSA POMS GN 00201.015 (alternative signature methods) — <https://secure.ssa.gov/poms.nsf/lnx/0200201015>; GN 00201.010 — <https://secure.ssa.gov/poms.nsf/lnx/0200201010>
- Voting Rights Act §208, 52 U.S.C. §10508 — <https://www.law.cornell.edu/uscode/text/52/10508>

**Industry practice**
- DocuSign signature adoption (Style/Draw/Upload) — <https://www.docusign.com/blog/quick-tip-customizing-your-signature>; audit trail — <https://www.docusign.com/blog/what-is-an-audit-trail>
- Adobe Acrobat Sign Type/Draw/Image options — <https://helpx.adobe.com/sign/config/sig-prefs/allow-recipients-sign-by.html> *(unverified — page timed out on every direct fetch; known via search snippets only)*

**Known gaps / unverified items** (flagged inline above, collected here):
UETA adoption count rests on the NYC Bar report; Restatement §134 verified via a
court opinion, not ALI text; one UCC comment sentence ("a complete signature is
not necessary") verified only in paraphrase; Colorado election statute via
FindLaw; FedEx COVID wording from a regional page; UPS tariff is the 2024
edition; UPS DIAD capture mechanics from search snippets; Adobe docs unfetched;
SSA signature-by-mark language now lives in SSA forms (seen in snippets) rather
than the POMS sections fetched; no DOJ guidance specifically on signature
alternatives was located.
