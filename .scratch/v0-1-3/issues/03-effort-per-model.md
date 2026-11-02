# 03: Reasoning effort per model

Spec: `.scratch/v0-1-3/spec.md`

**What to build:** Each model in your models has an effort from the levels it offers (pi-ai's `getSupportedThinkingLevels`), with the provider's own names. It's set on the model's row in Your models and shown and changeable next to the Interviewer and Feedback pickers; two roles using one model share it. Every model call sends the model's effort instead of the hard-coded `low` and logs it. Models with no levels show no picker. Existing reasoning models migrate to `low`.

**Blocked by:** None

**Status:** done

- [x] settings.json keeps `effort` per model; migration sets `low` on models that reason
- [x] Your models rows and the role pickers show and change it, only for models with levels
- [x] Calls send the model's effort; `modelCall` events record it
- [x] Providers tests assert the effort sent; end-to-end tests cover changing it

Done: `effort` rides on your models' entries (`withEffort` gives a role's model its effort). No migration was needed: an absent effort means `defaultEffort` (`low`), which is what v0.1.2 sent. Settings → Model shows an "<Role> reasoning" picker under each role whose model has levels; there is no separate Your models list, so the role rows are where it's set. Ollama lists no levels for now.
