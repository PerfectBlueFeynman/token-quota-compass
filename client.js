// Generated with AI for personal use.
// Do NOT upload to extensions.gnome.org (EGO) unless you understand JavaScript
// and can maintain this code.
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import {normalizeResult} from './normalize.js';

async function run(cli, provider, cancellable, allAccounts, source) {
    const flags = Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_PIPE;
    const argv = [cli, 'usage', '--provider', provider];
    if (allAccounts)
        argv.push('--all-accounts');
    argv.push('--source', source, '--format', 'json');
    const process = Gio.Subprocess.new(argv, flags);
    let timer = 0;
    const cancelId = cancellable.connect(() => process.force_exit());
    timer = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 30000, () => {
        process.force_exit();
        return GLib.SOURCE_REMOVE;
    });
    try {
        const [, stdout] = await new Promise((resolve, reject) => {
            process.communicate_utf8_async(null, null, (self, result) => {
                try {
                    resolve(self.communicate_utf8_finish(result));
                } catch (error) {
                    reject(error);
                }
            });
        });
        if (cancellable.is_cancelled())
            return [];
        const json = JSON.parse(stdout);
        if (!process.get_successful()) {
            const entry = Array.isArray(json) ? json[0] : json;
            if (allAccounts && entry?.error?.message?.includes('No token accounts configured'))
                return null;
            throw new Error('Usage query failed');
        }
        return normalizeResult(provider, json);
    } finally {
        if (timer)
            GLib.Source.remove(timer);
        cancellable.disconnect(cancelId);
    }
}

export async function queryProvider(cli, provider, cancellable) {
    const sources = provider === 'codex' ? ['oauth', 'auto'] : ['auto'];
    let lastError;
    for (const source of sources) {
        try {
            const accounts = await run(cli, provider, cancellable, true, source);
            return accounts ?? await run(cli, provider, cancellable, false, source);
        } catch (error) {
            if (cancellable.is_cancelled())
                return [];
            lastError = error;
        }
    }
    throw lastError;
}
