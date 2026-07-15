#!/usr/bin/env node

import { lookupSeed, searchStatKeys, lookupAlternateSkill, initialize, JEWEL_TYPES } from './engine/calculator.js';
import type { LookupResult, AlternateSkillInfo } from './engine/calculator.js';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
// Data is in the cli/data directory, go up from src/
const DATA_DIR = resolve(__dirname, '../data');

// --- CLI argument parsing ---

interface ParsedArgs {
    command?: string;
    seed?: number;
    jewelType?: number;
    statKeys: number[];
    statQueries: string[];
    infoQuery?: string;
    skillQuery?: string;
    format?: 'table' | 'compact' | 'json';
    top?: number;
    help: boolean;
    scan: boolean;
    scanLimit?: number;
}

function parseArgs(args: string[]): ParsedArgs {
    const result: ParsedArgs = {
        statKeys: [],
        statQueries: [],
        format: 'table',
        help: false,
        scan: false,
        infoQuery: undefined,
    };

    let i = 0;
    while (i < args.length) {
        const arg = args[i];

        switch (arg) {
            case '--help':
            case '-h':
                result.help = true;
                break;

            case '--jewel':
            case '-j':
                i++;
                result.jewelType = parseJewelType(args[i]);
                break;

            case '--format':
            case '-f':
                i++;
                result.format = args[i] as ParsedArgs['format'];
                break;

            case '--top':
            case '-t':
                i++;
                result.top = parseInt(args[i], 10);
                break;

            case '--scan':
                result.scan = true;
                break;

            case '--scan-limit':
                i++;
                result.scanLimit = parseInt(args[i], 10);
                break;

            case '--info':
                i++;
                result.command = 'info';
                result.infoQuery = args[i];
                break;

            case '--skill':
                i++;
                result.skillQuery = args[i];
                break;

            case '--search':
            case '-s':
                i++;
                result.command = 'search';
                result.statQueries.push(args[i]);
                break;

            default:
                // Try to parse as stat key (number) or seed (first positional)
                const num = parseInt(arg, 10);
                if (!isNaN(num)) {
                    if (result.scan) {
                        // In scan mode, all numbers are stat keys
                        result.statKeys.push(num);
                    } else if (result.seed === undefined) {
                        result.seed = num;
                    } else {
                        result.statKeys.push(num);
                    }
                } else if (!result.command) {
                    // Treat as stat query
                    result.statQueries.push(arg);
                }
                break;
        }
        i++;
    }

    return result;
}

function parseJewelType(input: string): number {
    const lower = input.toLowerCase();
    const jewel = JEWEL_TYPES.find(j =>
        j.name === lower ||
        j.label.toLowerCase() === lower ||
        String(j.id) === lower
    );
    return jewel?.id ?? 6; // default to Heroic Tragedy
}

function printHelp(): void {
    console.log(`
Timeless Jewel Seed Lookup CLI
================================

Usage:
  tj-lookup <seed> <stat_key1> [stat_key2 ...] [options]
  tj-lookup <seed> --skill "<skill_id>" [options]
  tj-lookup --scan <stat_key1> [stat_key2 ...] [options]
  tj-lookup --info "<skill_id>" [options]
  tj-lookup <seed> --search "<query>" [options]

Commands:
  <seed> <stat_keys...>   Lookup a seed for specific stat keys
  <seed> --skill <id>     Lookup a seed, filtered to a specific alternate skill
  --scan <stat_keys...>   Scan ALL seeds for best matches
  --info "<skill_id>"     Lookup alternate passive skill by ID
  --search "<query>"       Search for stat keys by name

Options:
  -j, --jewel <type>       Jewel type (default: kalguur/6)
                           vaal(1), karui(2), maraketh(3), templar(4),
                           eternal(5), kalguur(6)
  --skill <id>             Filter to a specific alternate skill ID
                           (auto-extracts stat keys from the skill)
  -f, --format <format>    Output format: table, compact, json (default: table)
  -t, --top <n>            Show only top N sockets (default: all)
  --scan-limit <n>         Limit scan results to top N seeds (default: 10)
  -h, --help               Show this help message

Examples:
  tj-lookup 1234 42                          # Seed 1234, stat key 42 (Fire Damage)
  tj-lookup 1234 42 49 56                    # Seed 1234, Fire + Cold + Lightning
  tj-lookup 205 --skill "kalguur_notable_17" # Seed 205, only Starborn Birth nodes
  tj-lookup --scan 42                        # Scan all seeds for Fire Damage
  tj-lookup --scan 42 -j vaal -t 5           # Scan Vaal seeds, show top 5 sockets
  tj-lookup --info "kalguur_notable_17"      # Info on kalguur_notable_17
  tj-lookup --info "kalguur"                 # List all kalguur alternate skills
  tj-lookup 1234 --search "fire damage"      # Search for fire damage stats
  tj-lookup 1234 42 -j karui -f compact      # Karui jewel, compact output
  tj-lookup 1234 42 -t 5                     # Show only top 5 sockets

Stat key reference (common):
  42  = Fire Damage          70  = Attack Speed
  49  = Cold Damage          218 = Cast Speed
  56  = Lightning Damage     179 = Movement Speed
  26  = Physical Damage      125 = Life
  63  = Chaos Damage         129 = Mana
  25  = Spell Damage         117 = Armour
  490 = Elemental Damage     120 = Evasion
  135 = Energy Shield
`);
}

// --- Output formatting ---

function formatTable(result: LookupResult, topN?: number): string {
    const lines: string[] = [];

    // Header
    const skillLabel = result.targetSkillName ? `Skill: ${result.targetSkillName} (${result.targetSkillId})  |  ` : '';
    lines.push('');
    lines.push(`  Seed: ${result.seed}  |  Jewel: ${result.jewelLabel}  |  ${skillLabel}Stats: ${result.targetLabels.join(', ')}`);
    lines.push(`  Grand Total: ${result.grandTotal} matching nodes across all sockets`);
    lines.push('');

    // Filter to top N if requested
    const displayResults = topN ? result.socketResults.slice(0, topN) : result.socketResults;

    // Table header
    const header = `  ${'Socket'.padEnd(20)} ${'Position'.padEnd(14)} ${'Matches'.padStart(7)}`;
    lines.push(header);
    lines.push('  ' + '-'.repeat(header.length - 2));

    for (const socket of displayResults) {
        const x = Math.round(socket.socketCoords.x);
        const y = Math.round(socket.socketCoords.y);
        const pos = `(${x}, ${y})`;
        const line = `  ${socket.socketAlias.padEnd(20)} ${pos.padEnd(14)} ${String(socket.totalMatchCount).padStart(7)}`;
        lines.push(line);
    }

    // Best socket(s)
    if (result.bestSockets.length > 0 && result.bestSockets[0].totalMatchCount > 0) {
        lines.push('');
        lines.push('  Best socket(s):');
        for (const socket of result.bestSockets) {
            lines.push(`    ${socket.socketAlias} (${socket.socketId}) - ${socket.totalMatchCount} matches`);
        }
    }

    // Detail for top socket
    if (displayResults.length > 0 && displayResults[0].matches.length > 0) {
        lines.push('');
        lines.push(`  Detail for "${displayResults[0].socketAlias}" (${displayResults[0].matches.length} matches):`);
        for (const match of displayResults[0].matches) {
            lines.push(`    [${match.source}] ${match.nodeName}: ${match.statLabel}`);
        }
    }

    return lines.join('\n');
}

function formatCompact(result: LookupResult, topN?: number): string {
    const displayResults = topN ? result.socketResults.slice(0, topN) : result.socketResults;

    const lines: string[] = [];
    const skillLabel = result.targetSkillName ? `Skill: ${result.targetSkillName} | ` : '';
    lines.push(`Seed ${result.seed} (${result.jewelLabel}) | ${skillLabel}Stats: ${result.targetLabels.join(', ')} | Total: ${result.grandTotal}`);

    for (const socket of displayResults) {
        if (socket.totalMatchCount === 0) continue;
        const x = Math.round(socket.socketCoords.x);
        const y = Math.round(socket.socketCoords.y);
        lines.push(`  ${socket.socketId} ${socket.socketAlias}: ${socket.totalMatchCount} matches (${x}, ${y})`);
    }

    return lines.join('\n');
}

function formatJson(result: LookupResult, topN?: number): string {
    if (topN) {
        result.socketResults = result.socketResults.slice(0, topN);
    }
    return JSON.stringify(result, null, 2);
}

// --- Main ---

async function main(): Promise<void> {
    const args = process.argv.slice(2);
    const parsed = parseArgs(args);

    if (parsed.help || args.length === 0) {
        printHelp();
        process.exit(0);
    }

    // Initialize data
    await initialize(DATA_DIR);

    // Handle search command
    if (parsed.command === 'search') {
        for (const query of parsed.statQueries) {
            console.log(`\nSearching for: "${query}"`);
            const results = await searchStatKeys(query);
            if (results.length === 0) {
                console.log('  No matching stats found.');
            } else {
                console.log(`  Found ${results.length} matching stat(s):`);
                for (const r of results.slice(0, 20)) {
                    console.log(`    Key ${r.key}: ${r.label}`);
                }
                if (results.length > 20) {
                    console.log(`    ... and ${results.length - 20} more`);
                }
            }
        }
        process.exit(0);
    }

    // Handle info command (lookup alternate passive skill by ID)
    if (parsed.command === 'info' && parsed.infoQuery) {
        const results = await lookupAlternateSkill(parsed.infoQuery);
        if (results.length === 0) {
            console.log(`No alternate passive skills found matching: "${parsed.infoQuery}"`);
        } else {
            console.log(`Found ${results.length} matching alternate passive skill(s):\n`);
            for (const skill of results) {
                console.log(`  ID:            ${skill.id}`);
                console.log(`  Name:          ${skill.name}`);
                console.log(`  Jewel:         ${skill.jewelLabel} (${skill.jewelType})`);
                console.log(`  Passive Type:  ${skill.passiveType.join(', ')}`);
                console.log(`  Spawn Weight:  ${skill.spawnWeight}`);
                console.log(`  Stats:`);
                for (const stat of skill.stats) {
                    const range = stat.min === stat.max ? String(stat.min) : `${stat.min}-${stat.max}`;
                    console.log(`    Key ${stat.key}: ${range} -> ${stat.label}`);
                }
                console.log('');
            }
        }
        process.exit(0);
    }

    // Resolve stat keys from skill query or stat queries
    let statKeys = [...parsed.statKeys];
    let skillId: string | undefined;

    if (parsed.skillQuery) {
        const skillResults = await lookupAlternateSkill(parsed.skillQuery);
        if (skillResults.length === 0) {
            console.error(`Error: No alternate skill found matching: "${parsed.skillQuery}"`);
            process.exit(1);
        }
        // Use first match
        const skill = skillResults[0];
        skillId = skill.id;
        // Collect all stat keys from this skill
        for (const stat of skill.stats) {
            statKeys.push(stat.key);
        }
    } else {
        for (const query of parsed.statQueries) {
            const results = await searchStatKeys(query);
            if (results.length === 0) {
                console.error(`Warning: No stats found for query "${query}"`);
            } else {
                statKeys.push(results[0].key);
            }
        }
    }

    if (statKeys.length === 0) {
        console.error('Error: At least one stat key or --skill is required.');
        console.error('Usage: tj-lookup <seed> <stat_key1> [stat_key2 ...] [options]');
        console.error('       tj-lookup <seed> --skill "kalguur_notable_17" [options]');
        console.error('       tj-lookup --scan <stat_key1> [stat_key2 ...] [options]');
        process.exit(1);
    }

    const jewelType = parsed.jewelType ?? 6;
    const jewelInfo = JEWEL_TYPES.find(j => j.id === jewelType);
    if (!jewelInfo) {
        console.error(`Error: Unknown jewel type. Use: vaal, karui, maraketh, templar, eternal, kalguur`);
        process.exit(1);
    }

    // Handle scan mode
    if (parsed.scan) {
        const limit = parsed.scanLimit ?? 10;
        const scanLabel = skillId ? `skill "${skillId}"` : `${statKeys.length === 1 ? `stat ${statKeys[0]}` : `stats ${statKeys.join(', ')}`}`;
        console.log(`Scanning all ${jewelInfo.label} seeds for ${scanLabel}...`);
        console.log(`This may take a moment (${jewelInfo.max - jewelInfo.min + 1} seeds to check)\n`);

        const scanResults: { seed: number; bestCount: number; bestSocket: string }[] = [];

        for (let seed = jewelInfo.min; seed <= jewelInfo.max; seed++) {
            const result = await lookupSeed(seed, jewelType, statKeys, skillId);
            if (result.bestSockets.length > 0 && result.bestSockets[0].totalMatchCount > 0) {
                scanResults.push({
                    seed,
                    bestCount: result.bestSockets[0].totalMatchCount,
                    bestSocket: result.bestSockets[0].socketAlias,
                });
            }
        }

        // Sort by best count descending
        scanResults.sort((a, b) => b.bestCount - a.bestCount);

        // Show top N
        const topResults = scanResults.slice(0, limit);

        if (topResults.length === 0) {
            console.log('No seeds found with matching stats.');
        } else {
            console.log(`Top ${topResults.length} seed(s):`);
            console.log(`  ${'Seed'.padEnd(8)} ${'Best Count'.padEnd(12)} ${'Best Socket'}`);
            console.log('  ' + '-'.repeat(60));
            for (const r of topResults) {
                console.log(`  ${String(r.seed).padEnd(8)} ${String(r.bestCount).padEnd(12)} ${r.bestSocket}`);
            }
        }

        process.exit(0);
    }

    // Validate seed for lookup mode
    if (parsed.seed === undefined) {
        console.error('Error: Seed is required.');
        console.error('Usage: tj-lookup <seed> <stat_key1> [stat_key2 ...] [options]');
        process.exit(1);
    }

    // Run lookup
    const result = await lookupSeed(parsed.seed, jewelType, statKeys, skillId);

    // Output
    switch (parsed.format) {
        case 'json':
            console.log(formatJson(result, parsed.top));
            break;
        case 'compact':
            console.log(formatCompact(result, parsed.top));
            break;
        default:
            console.log(formatTable(result, parsed.top));
            break;
    }
}

main().catch(err => {
    console.error('Error:', err.message);
    process.exit(1);
});
