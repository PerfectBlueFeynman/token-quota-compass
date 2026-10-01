// Generated with AI for personal use.
// Do NOT upload to extensions.gnome.org (EGO) unless you understand JavaScript
// and can maintain this code.
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';

export const PROVIDER_IDS = ['codex', 'openai', 'azure-openai', 'claude', 'clinepass',
    'cursor', 'opencode', 'opencodego', 'alibaba-coding-plan', 'alibaba-token-plan',
    'qwen-cloud', 'factory', 'fireworks', 'gemini', 'antigravity', 'copilot',
    'devin', 'zai', 'minimax', 'manus', 'kimi', 'kilo', 'kiro', 'vertexai',
    'augment', 'jetbrains', 'moonshot', 'amp', 't3chat', 'ollama', 'synthetic',
    'openrouter', 'elevenlabs', 'warp', 'windsurf', 'zed', 'perplexity', 'mimo',
    'doubao', 'sakana', 'abacusai', 'mistral', 'deepseek', 'deepinfra', 'codebuff',
    'venice', 'commandcode', 'qoder', 'stepfun', 'bedrock', 'grok', 'groqcloud',
    'llmproxy', 'litellm', 'bifrost', 'aixy', 'deepgram', 'poe', 'chutes',
    'neuralwatt', 'helmcode', 'clawrouter', 'longcat', 'sub2api', 'wayfinder',
    'zenmux', 'aiand', 'zoommate', 'xai', 'notion', 'ibmbob', 'nous', 'muse',
    'coderabbit', 'replicate', 'huggingface', 'raycast', 'pi', 'v0', 'typesafe',
    'hyper', 'gitkraken', 'devpass', 'atlascloud', 'vercel', 'llmman', 'xkiro'];
const IDS = new Set(PROVIDER_IDS);

const ALIASES = {azureopenai: 'azure-openai', alibaba: 'alibaba-coding-plan',
    alibabatokenplan: 'alibaba-token-plan', qwencloud: 'qwen-cloud',
    abacus: 'abacusai', crof: 'bifrost'};

function add(ids, id) {
    const canonical = ALIASES[id] || id;
    if (IDS.has(canonical))
        ids.add(canonical);
}

function exists(path) {
    return Gio.File.new_for_path(GLib.build_filenamev([GLib.get_home_dir(), path]))
        .query_exists(null);
}

export function discoverProviders(extra = '') {
    const ids = new Set();
    const configPaths = [
        GLib.build_filenamev([GLib.get_user_config_dir(), 'codexbar', 'config.json']),
        GLib.build_filenamev([GLib.get_home_dir(), '.codexbar', 'config.json']),
    ];
    for (const configPath of configPaths) {
        try {
            const [ok, bytes] = GLib.file_get_contents(configPath);
            if (ok) {
                const config = JSON.parse(new TextDecoder().decode(bytes));
                for (const provider of config.providers || []) {
                    if (provider.enabled && typeof provider.id === 'string')
                        add(ids, provider.id);
                }
                break;
            }
        } catch (_error) {
            // A missing or older CodexBar config is normal.
        }
    }

    // Check only for client presence. Credential contents are never opened.
    if (exists('.codex/auth.json'))
        ids.add('codex');
    if (exists('.claude/.credentials.json') || exists('.config/claude'))
        ids.add('claude');
    if (exists('.config/opencode') || exists('.local/share/opencode'))
        ids.add('opencode');
    if (exists('.config/gemini') || exists('.gemini'))
        ids.add('gemini');
    for (const id of extra.split(/[\s,]+/).filter(Boolean))
        add(ids, id.toLowerCase());
    return [...ids];
}

export function findCli() {
    const inPath = GLib.find_program_in_path('codexbar');
    if (inPath)
        return inPath;
    for (const path of [
        GLib.build_filenamev([GLib.get_home_dir(), '.local', 'bin', 'codexbar']),
        '/home/linuxbrew/.linuxbrew/bin/codexbar',
        '/usr/local/bin/codexbar',
        '/usr/bin/codexbar',
    ]) {
        if (Gio.File.new_for_path(path).query_exists(null))
            return path;
    }
    return null;
}
