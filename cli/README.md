# Timeless Jewel Seed Lookup CLI

A command-line tool for looking up Timeless Jewel seeds across all passive tree jewel sockets. Given a seed and desired stat(s), it checks all 21 jewel socket positions and reports how many nodes match at each socket.

## Installation

```bash
cd cli
npm install
npm run build
```

## Usage

```bash
# Using tsx (development)
npx tsx src/index.ts <seed> <stat_key> [options]

# Using built binary
node dist/index.js <seed> <stat_key> [options]
```

### Commands

```bash
# Lookup Regenerative Runes for Heroic Tragedy (compact output, showing top 3 matches)
node dist/index.js 1234 22505 -f compact -t 3

# Lookup seed 1234 for Fire Damage (stat key 42)
node dist/index.js 1234 42

# Lookup with multiple stats (Fire + Cold + Lightning)
node dist/index.js 1234 42 49 56

# Lookup a seed filtered to a specific alternate skill
node dist/index.js 205 --skill "kalguur_notable_17"

# Lookup alternate passive skill by ID
node dist/index.js --info "kalguur_notable_17"

# List all kalguur alternate skills
node dist/index.js --info "kalguur"

# Search for stat keys by name
node dist/index.js 1234 --search "fire damage"

# Specify jewel type (default: Heroic Tragedy)
node dist/index.js 1234 42 -j vaal

# Compact output, show only top 5 sockets
node dist/index.js 1234 42 -f compact -t 5

# JSON output
node dist/index.js 1234 42 -f json
```

### Options

| Flag | Description | Default |
|------|-------------|---------|
| `-j, --jewel <type>` | Jewel type | `kalguur` (Heroic Tragedy) |
| `-f, --format <fmt>` | Output format: `table`, `compact`, `json` | `table` |
| `-t, --top <n>` | Show only top N sockets | all |
| `-s, --search <query>` | Search for stat keys by name | - |
| `-h, --help` | Show help | - |

### Alternate Passive Skills

Use `--info` to look up alternate passive skills by their internal ID, or `--skill` to filter a seed lookup to only nodes replaced by that specific skill.

```bash
# Look up a specific skill
node dist/index.js --info "kalguur_notable_17"

# List all skills for a jewel type (partial match)
node dist/index.js --info "kalguur"
node dist/index.js --info "vaal_notable_fire"

# See all keystone options
node dist/index.js --info "keystone"

# Filter a seed lookup to only one alternate skill
node dist/index.js 205 --skill "kalguur_notable_17"
```

The `--skill` flag is useful when you want to find nodes replaced by a specific alternate skill rather than all nodes that happen to share the same stat key. For example, searching for stat key `14501` (Ward) matches 125 nodes across all Ward skills, but `--skill "kalguur_notable_17"` only matches the 14 nodes specifically replaced by Starborn Birth (fixed 25% Ward).

Each `--info` result shows:
- **ID**: Internal skill identifier
- **Name**: Display name of the alternate skill
- **Jewel**: Which jewel type it belongs to
- **Passive Type**: Notable, KeyStone, SmallAttribute, or SmallNormal
- **Spawn Weight**: Relative weight for RNG selection
- **Stats**: Stat keys with value ranges and translated labels

### Jewel Types

| Name | ID | Seed Range |
|------|-----|------------|
| Glorious Vanity (Vaal) | `vaal` / `1` | 100-8000 |
| Lethal Pride (Karui) | `karui` / `2` | 10000-18000 |
| Brutal Restraint (Maraketh) | `maraketh` / `3` | 500-8000 |
| Militant Faith (Templar) | `templar` / `4` | 2000-10000 |
| Elegant Hubris (Eternal) | `eternal` / `5` | 2000-160000 |
| Heroic Tragedy (Kalguur) | `kalguur` / `6` | 100-8000 |

### Socket Naming

Sockets are identified by the name of their nearest keystone, which is the common community naming convention:

| Socket ID | Name | Socket ID | Name |
|-----------|------|-----------|------|
| 2491 | Arsenal of Vengeance | 33989 | Supreme Ego |
| 6230 | Iron Will | 34483 | Elemental Equilibrium |
| 7960 | Elemental Overload | 36634 | Mind Over Matter |
| 21984 | Eldritch Battery | 41263 | Pain Attunement |
| 26196 | The Agnostic | 46882 | Point Blank |
| 26725 | Avatar of Fire | 48768 | Conduit |
| 28475 | Unwavering Stance | 54127 | Iron Reflexes |
| 31683 | Iron Grip | 55190 | Resolute Technique |
| 32763 | Perfect Agony | 60735 | Wind Dancer |
| 33631 | Eternal Youth | 61419 | Minion Instability |
| | | 61834 | Ghost Dance |

### Common Stat Keys

| Key | Stat | Key | Stat |
|-----|------|-----|------|
| 42 | Fire Damage | 70 | Attack Speed |
| 49 | Cold Damage | 218 | Cast Speed |
| 56 | Lightning Damage | 179 | Movement Speed |
| 26 | Physical Damage | 125 | Life |
| 63 | Chaos Damage | 129 | Mana |
| 25 | Spell Damage | 117 | Armour |
| 490 | Elemental Damage | 120 | Evasion |
| 135 | Energy Shield | | |

## Examples

### Find best socket for a Heroic Tragedy seed with Armour

```bash
node dist/index.js 1234 117
```

### Compare a Vaal seed across all sockets for Fire Damage

```bash
node dist/index.js 500 42 -j vaal
```

### Quick lookup in compact format

```bash
node dist/index.js 1234 117 -f compact -t 3
```

### Search for a stat, then lookup

```bash
node dist/index.js 1234 --search "attack speed"
```

## How It Works

The tool uses the same PRNG algorithm as Path of Exile's alternate passive tree generation. For a given seed and jewel type:

1. For each of the 21 jewel socket positions on the passive tree
2. It identifies which nodes are in range of that socket
3. It simulates the jewel's RNG to determine which nodes get replaced/augmented
4. It checks if any of the replacements/augmentations contain the desired stat keys
5. Results are sorted by match count (highest first)

## Project Structure

```
cli/
├── src/
│   ├── index.ts              # CLI entry point & argument parsing
│   └── engine/
│       ├── calculator.ts     # Main calculation engine
│       ├── random.ts         # Xorshift PRNG (PoE algorithm)
│       ├── jewel.ts          # TimelessJewel class
│       ├── tree-version.ts   # AlternateTreeVersion class
│       └── types.ts          # Type definitions
├── data/                     # Passive tree data (copied from main app)
│   ├── data.json             # Passive skill nodes
│   ├── tree.json             # Tree structure + socket nodes
│   ├── alternatepassiveskills.json
│   ├── alternatepassiveadditions.json
│   └── translation.json      # Stat key -> text translations
├── dist/                     # Compiled output
├── package.json
└── tsconfig.json
```
