# MotionKit diagnostic (planning branch only)

npm ci exit: 0

npm run lint exit: 2

node --test selector exit: 0

npm run check:consistency exit: 1


## lint (last 85 lines)

```text
vendor-catalog/boardui-free/components/base/social-button/social-button.tsx(2,28): error TS2307: Cannot find module '@/utils/cx' or its corresponding type declarations.
vendor-catalog/boardui-free/components/base/social-button/social-button.tsx(3,36): error TS2307: Cannot find module '@/components/base/social-button/social-color-logos' or its corresponding type declarations.
vendor-catalog/boardui-free/components/base/social-button/social-button.tsx(7,8): error TS2307: Cannot find module '@/components/base/social-button/social-providers' or its corresponding type declarations.
vendor-catalog/boardui-free/components/base/social-button/social-color-logos.ts(20,37): error TS2307: Cannot find module '@/components/base/social-button/social-providers' or its corresponding type declarations.
vendor-catalog/boardui-free/components/base/switch/switch-card.tsx(4,38): error TS2307: Cannot find module 'react-aria-components' or its corresponding type declarations.
vendor-catalog/boardui-free/components/base/switch/switch-card.tsx(5,53): error TS2307: Cannot find module 'react-aria-components' or its corresponding type declarations.
vendor-catalog/boardui-free/components/base/switch/switch-card.tsx(6,20): error TS2307: Cannot find module '@/utils/cx' or its corresponding type declarations.
vendor-catalog/boardui-free/components/base/switch/switch-card.tsx(51,19): error TS7006: Parameter 'state' implicitly has an 'any' type.
vendor-catalog/boardui-free/components/base/switch/switch-card.tsx(63,9): error TS7006: Parameter 'state' implicitly has an 'any' type.
vendor-catalog/boardui-free/components/base/switch/switch.tsx(4,38): error TS2307: Cannot find module 'react-aria-components' or its corresponding type declarations.
vendor-catalog/boardui-free/components/base/switch/switch.tsx(5,53): error TS2307: Cannot find module 'react-aria-components' or its corresponding type declarations.
vendor-catalog/boardui-free/components/base/switch/switch.tsx(6,28): error TS2307: Cannot find module '@/utils/cx' or its corresponding type declarations.
vendor-catalog/boardui-free/components/base/switch/switch.tsx(154,19): error TS7006: Parameter 'state' implicitly has an 'any' type.
vendor-catalog/boardui-free/components/base/switch/switch.tsx(162,9): error TS7006: Parameter 'state' implicitly has an 'any' type.
vendor-catalog/boardui-free/components/base/table/table.tsx(11,8): error TS2307: Cannot find module 'react-aria-components' or its corresponding type declarations.
vendor-catalog/boardui-free/components/base/table/table.tsx(12,51): error TS2307: Cannot find module 'react-aria-components' or its corresponding type declarations.
vendor-catalog/boardui-free/components/base/table/table.tsx(13,20): error TS2307: Cannot find module '@/utils/cx' or its corresponding type declarations.
vendor-catalog/boardui-free/components/base/tabs/pill-tab.tsx(3,30): error TS2307: Cannot find module '@/components/foundations/direction/direction' or its corresponding type declarations.
vendor-catalog/boardui-free/components/base/tabs/pill-tab.tsx(6,28): error TS2307: Cannot find module '@/utils/cx' or its corresponding type declarations.
vendor-catalog/boardui-free/components/base/tabs/tabs.tsx(3,30): error TS2307: Cannot find module '@/components/foundations/direction/direction' or its corresponding type declarations.
vendor-catalog/boardui-free/components/base/tabs/tabs.tsx(11,8): error TS2307: Cannot find module 'react-aria-components' or its corresponding type declarations.
vendor-catalog/boardui-free/components/base/tabs/tabs.tsx(17,8): error TS2307: Cannot find module 'react-aria-components' or its corresponding type declarations.
vendor-catalog/boardui-free/components/base/tabs/tabs.tsx(18,20): error TS2307: Cannot find module '@/utils/cx' or its corresponding type declarations.
vendor-catalog/boardui-free/components/base/tabs/tabs.tsx(48,24): error TS2339: Property 'className' does not exist on type 'TabsProps'.
vendor-catalog/boardui-free/components/base/tabs/tabs.tsx(53,19): error TS7006: Parameter 'state' implicitly has an 'any' type.
vendor-catalog/boardui-free/components/base/tabs/tabs.tsx(70,45): error TS2339: Property 'className' does not exist on type 'TabListProps<T>'.
vendor-catalog/boardui-free/components/base/tabs/tabs.tsx(103,21): error TS7006: Parameter 'state' implicitly has an 'any' type.
vendor-catalog/boardui-free/components/base/tabs/tabs.tsx(138,19): error TS7006: Parameter 'state' implicitly has an 'any' type.
vendor-catalog/boardui-free/components/base/tabs/tabs.tsx(148,11): error TS7031: Binding element 'isSelected' implicitly has an 'any' type.
vendor-catalog/boardui-free/components/base/tabs/tabs.tsx(183,28): error TS2339: Property 'className' does not exist on type 'TabPanelProps'.
vendor-catalog/boardui-free/components/base/tabs/tabs.tsx(188,19): error TS7006: Parameter 'state' implicitly has an 'any' type.
vendor-catalog/boardui-free/components/base/textarea/textarea.tsx(11,62): error TS2307: Cannot find module 'react-aria-components' or its corresponding type declarations.
vendor-catalog/boardui-free/components/base/textarea/textarea.tsx(12,57): error TS2307: Cannot find module 'react-aria-components' or its corresponding type declarations.
vendor-catalog/boardui-free/components/base/textarea/textarea.tsx(13,26): error TS2307: Cannot find module '@/components/base/input/hint-text' or its corresponding type declarations.
vendor-catalog/boardui-free/components/base/textarea/textarea.tsx(14,23): error TS2307: Cannot find module '@/components/base/input/label' or its corresponding type declarations.
vendor-catalog/boardui-free/components/base/textarea/textarea.tsx(20,8): error TS2307: Cannot find module '@/components/base/input/input' or its corresponding type declarations.
vendor-catalog/boardui-free/components/base/textarea/textarea.tsx(21,28): error TS2307: Cannot find module '@/utils/cx' or its corresponding type declarations.
vendor-catalog/boardui-free/components/base/textarea/textarea.tsx(125,42): error TS18046: 'ctx' is of type 'unknown'.
vendor-catalog/boardui-free/components/base/textarea/textarea.tsx(164,21): error TS7031: Binding element 'isFocusWithin' implicitly has an 'any' type.
vendor-catalog/boardui-free/components/base/textarea/textarea.tsx(164,36): error TS7031: Binding element 'isHovered' implicitly has an 'any' type.
vendor-catalog/boardui-free/components/base/textarea/textarea.tsx(164,47): error TS7031: Binding element 'isDisabled' implicitly has an 'any' type.
vendor-catalog/boardui-free/components/base/textarea/textarea.tsx(164,59): error TS7031: Binding element 'isInvalid' implicitly has an 'any' type.
vendor-catalog/boardui-free/components/base/textarea/textarea.tsx(184,11): error TS18046: 'ctx' is of type 'unknown'.
vendor-catalog/boardui-free/components/base/textarea/textarea.tsx(193,19): error TS7006: Parameter 'event' implicitly has an 'any' type.
vendor-catalog/boardui-free/components/base/textarea/textarea.tsx(200,11): error TS18046: 'ctx' is of type 'unknown'.
vendor-catalog/boardui-free/components/base/textarea/textarea.tsx(268,18): error TS7006: Parameter 'next' implicitly has an 'any' type.
vendor-catalog/boardui-free/components/base/textarea/textarea.tsx(280,11): error TS7031: Binding element 'isRequired' implicitly has an 'any' type.
vendor-catalog/boardui-free/components/base/textarea/textarea.tsx(280,23): error TS7031: Binding element 'isInvalid' implicitly has an 'any' type.
vendor-catalog/boardui-free/components/base/tooltip/tooltip.tsx(8,8): error TS2307: Cannot find module 'react-aria-components' or its corresponding type declarations.
vendor-catalog/boardui-free/components/base/tooltip/tooltip.tsx(9,55): error TS2307: Cannot find module 'react-aria-components' or its corresponding type declarations.
vendor-catalog/boardui-free/components/base/tooltip/tooltip.tsx(10,28): error TS2307: Cannot find module '@/utils/cx' or its corresponding type declarations.
vendor-catalog/boardui-free/components/base/tooltip/tooltip.tsx(11,30): error TS2307: Cannot find module '@/components/foundations/direction/direction' or its corresponding type declarations.
vendor-catalog/boardui-free/components/base/tooltip/tooltip.tsx(86,19): error TS7006: Parameter 'state' implicitly has an 'any' type.
vendor-catalog/boardui-free/components/base/tooltip/tooltip.tsx(103,15): error TS7031: Binding element 'placement' implicitly has an 'any' type.
vendor-catalog/boardui-free/components/base/tree-view/tree-view.tsx(5,73): error TS2307: Cannot find module 'motion/react' or its corresponding type declarations.
vendor-catalog/boardui-free/components/base/tree-view/tree-view.tsx(6,80): error TS2307: Cannot find module '@remixicon/react' or its corresponding type declarations.
vendor-catalog/boardui-free/components/base/tree-view/tree-view.tsx(15,8): error TS2307: Cannot find module 'react-aria-components' or its corresponding type declarations.
vendor-catalog/boardui-free/components/base/tree-view/tree-view.tsx(20,8): error TS2307: Cannot find module 'react-aria-components' or its corresponding type declarations.
vendor-catalog/boardui-free/components/base/tree-view/tree-view.tsx(21,30): error TS2307: Cannot find module '@/components/foundations/direction/direction' or its corresponding type declarations.
vendor-catalog/boardui-free/components/base/tree-view/tree-view.tsx(22,34): error TS2307: Cannot find module '@/components/base/dropdown/menu-styles' or its corresponding type declarations.
vendor-catalog/boardui-free/components/base/tree-view/tree-view.tsx(23,20): error TS2307: Cannot find module '@/utils/cx' or its corresponding type declarations.
vendor-catalog/boardui-free/components/base/tree-view/tree-view.tsx(48,3): error TS2339: Property 'selectionMode' does not exist on type 'TreeViewProps<T>'.
vendor-catalog/boardui-free/components/base/tree-view/tree-view.tsx(49,3): error TS2339: Property 'renderEmptyState' does not exist on type 'TreeViewProps<T>'.
vendor-catalog/boardui-free/components/base/tree-view/tree-view.tsx(50,3): error TS2339: Property 'className' does not exist on type 'TreeViewProps<T>'.
vendor-catalog/boardui-free/components/base/tree-view/tree-view.tsx(57,75): error TS2339: Property 'dragAndDropHooks' does not exist on type '{}'.
vendor-catalog/boardui-free/components/base/tree-view/tree-view.tsx(98,23): error TS7006: Parameter 'state' implicitly has an 'any' type.
vendor-catalog/boardui-free/components/base/tree-view/tree-view.tsx(148,15): error TS7006: Parameter 'state' implicitly has an 'any' type.
vendor-catalog/boardui-free/components/base/tree-view/tree-view.tsx(152,19): error TS7006: Parameter 'state' implicitly has an 'any' type.
vendor-catalog/boardui-free/components/base/tree-view/tree-view.tsx(164,13): error TS7031: Binding element 'hasChildItems' implicitly has an 'any' type.
vendor-catalog/boardui-free/components/base/tree-view/tree-view.tsx(164,28): error TS7031: Binding element 'isExpanded' implicitly has an 'any' type.
vendor-catalog/boardui-free/components/base/tree-view/tree-view.tsx(164,40): error TS7031: Binding element 'isDisabled' implicitly has an 'any' type.
vendor-catalog/boardui-free/components/base/tree-view/tree-view.tsx(164,52): error TS7031: Binding element 'level' implicitly has an 'any' type.
vendor-catalog/boardui-free/components/base/tree-view/tree-view.tsx(164,59): error TS7031: Binding element 'state' implicitly has an 'any' type.
vendor-catalog/boardui-free/components/base/tree-view/tree-view.tsx(164,66): error TS7031: Binding element 'id' implicitly has an 'any' type.
vendor-catalog/boardui-free/components/base/tree-view/tree-view.tsx(214,50): error TS2307: Cannot find module 'react-aria-components' or its corresponding type declarations.
vendor-catalog/boardui-free/components/base/tree-view/tree-view.tsx(227,48): error TS18046: 'node' is of type 'unknown'.
vendor-catalog/boardui-free/components/base/tree-view/tree-view.tsx(228,31): error TS18046: 'node' is of type 'unknown'.
vendor-catalog/boardui-free/components/base/tree-view/tree-view.tsx(229,12): error TS18046: 'node' is of type 'unknown'.
vendor-catalog/boardui-free/components/foundations/brand/logo.tsx(1,19): error TS2307: Cannot find module 'next/image' or its corresponding type declarations.
vendor-catalog/boardui-free/components/foundations/brand/logo.tsx(2,20): error TS2307: Cannot find module '@/utils/cx' or its corresponding type declarations.
vendor-catalog/boardui-free/components/foundations/direction/direction.tsx(4,41): error TS2307: Cannot find module 'react-aria-components' or its corresponding type declarations.
vendor-catalog/boardui-free/components/foundations/direction/direction.tsx(5,20): error TS2307: Cannot find module '@/utils/cx' or its corresponding type declarations.
vendor-catalog/boardui-free/components/foundations/icons/chevrons.tsx(2,20): error TS2307: Cannot find module '@/utils/cx' or its corresponding type declarations.
vendor-catalog/boardui-free/utils/cx.ts(1,37): error TS2307: Cannot find module 'tailwind-merge' or its corresponding type declarations.
vendor-catalog/boardui-free/utils/directional-icon.ts(8,8): error TS2307: Cannot find module '@remixicon/react' or its corresponding type declarations.
```

## selector (last 85 lines)

```text
TAP version 13
# Subtest: selection is deterministic, serializable and cannot touch the central CTA
ok 1 - selection is deterministic, serializable and cannot touch the central CTA
  ---
  duration_ms: 2.838189
  ...
# Subtest: lesson never adds a second teaching card or app dashboard HUD
ok 2 - lesson never adds a second teaching card or app dashboard HUD
  ---
  duration_ms: 0.635605
  ...
# Subtest: series can select varied complete sequences when history contains last choice
ok 3 - series can select varied complete sequences when history contains last choice
  ---
  duration_ms: 1.702982
  ...
# Subtest: every selected component is from the vetted register and compatible with content
ok 4 - every selected component is from the vetted register and compatible with content
  ---
  duration_ms: 0.736811
  ...
# Subtest: malformed episode IDs, missing narration, duplicate scenes and untyped content fail closed
ok 5 - malformed episode IDs, missing narration, duplicate scenes and untyped content fail closed
  ---
  duration_ms: 0.427463
  ...
# Subtest: unknown or CTA-only scenes never invent a cue or a component
ok 6 - unknown or CTA-only scenes never invent a cue or a component
  ---
  duration_ms: 0.112629
  ...
1..6
# tests 6
# suites 0
# pass 6
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 45.556588
```

## consistency (last 85 lines)

```text

> hsk-tu-vous@1.0.0 check:consistency
> node scripts/check-consistency.mjs

Consistency check failed:
 - Unregistered installed skill: transitions-dev
 - Unregistered installed skill: transitions-polish
 - Unregistered installed skill: transitions-ui-generation
```
