// Generated with AI for personal use.
// Do NOT upload to extensions.gnome.org (EGO) unless you understand JavaScript
// and can maintain this code.
import Adw from 'gi://Adw';
import Gtk from 'gi://Gtk?version=4.0';
import {ExtensionPreferences} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';
import {discoverProviders, findCli, PROVIDER_IDS} from './discovery.js';

const SOURCE_NAMES = {codex: 'Codex', openai: 'OpenAI API',
    'azure-openai': 'Azure OpenAI', claude: 'Claude', opencode: 'OpenCode',
    opencodego: 'OpenCode Go', gemini: 'Gemini', copilot: 'GitHub Copilot',
    antigravity: 'Antigravity', openrouter: 'OpenRouter',
    deepseek: 'DeepSeek', perplexity: 'Perplexity', xai: 'xAI',
    grok: 'Grok', ollama: 'Ollama', mistral: 'Mistral'};

function sourceName(id) {
    return SOURCE_NAMES[id] || id.replaceAll('-', ' ').replace(/\b\w/g,
        letter => letter.toUpperCase());
}

export default class TokenQuotaCompassPreferences extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        const settings = this.getSettings();
        const page = new Adw.PreferencesPage();
        window.add(page);

        const group = new Adw.PreferencesGroup({title: 'Usage'});
        page.add(group);
        const remaining = new Adw.SwitchRow({title: 'Show Left instead of Used',
            subtitle: 'On: Left · Off: Used · applies to percentages and bars'});
        settings.bind('show-remaining', remaining, 'active', 0);
        group.add(remaining);

        const showSources = new Adw.SwitchRow({title: 'Show sources in top bar',
            subtitle: 'Turn off to keep only the menu button'});
        settings.bind('show-sources-in-bar', showSources, 'active', 0);
        group.add(showSources);

        const showAll = new Adw.SwitchRow({title: 'Show every selected source',
            subtitle: 'Turn off to show the first four and a count of the rest'});
        settings.bind('show-all-sources', showAll, 'active', 0);
        group.add(showAll);

        const interval = new Adw.SpinRow({title: 'Refresh interval',
            subtitle: 'Minutes between automatic queries',
            adjustment: new Gtk.Adjustment({lower: 2, upper: 120,
                step_increment: 1, page_increment: 5})});
        settings.bind('refresh-minutes', interval, 'value', 0);
        group.add(interval);

        const positionGroup = new Adw.PreferencesGroup({title: 'Panel position'});
        page.add(positionGroup);
        const positions = ['left', 'center-left', 'center-right', 'right'];
        const positionRow = new Adw.ComboRow({title: 'Top bar location',
            model: Gtk.StringList.new([
                'Left', 'Center · left of date', 'Center · right of date', 'Right',
            ])});
        positionRow.selected = Math.max(0,
            positions.indexOf(settings.get_string('panel-position')));
        positionRow.connect('notify::selected', () =>
            settings.set_string('panel-position', positions[positionRow.selected]));
        positionGroup.add(positionRow);

        const providerGroup = new Adw.PreferencesGroup({title: 'Sources',
            description: 'Select which detected sources to query and show. Add a supported source from the list if automatic discovery misses it.'});
        page.add(providerGroup);
        const addGroup = new Adw.PreferencesGroup({title: 'Add a source'});
        page.add(addGroup);

        const foundRows = [];
        const addSource = new Adw.ComboRow({title: 'Add supported source'});
        const addButton = new Gtk.Button({label: 'Add', valign: Gtk.Align.CENTER});
        addSource.add_suffix(addButton);
        let available = [];
        const refreshSources = () => {
            for (const row of foundRows)
                providerGroup.remove(row);
            foundRows.length = 0;
            const extras = settings.get_string('extra-providers').split(/[\s,]+/)
                .filter(Boolean);
            const detected = discoverProviders(settings.get_string('extra-providers'));
            const hidden = new Set(settings.get_strv('hidden-providers'));
            for (const id of detected) {
                const row = new Adw.SwitchRow({title: sourceName(id),
                    subtitle: extras.includes(id) ? 'Added in this extension' :
                        'Detected locally'});
                row.active = !hidden.has(id);
                row.connect('notify::active', () => {
                    const next = new Set(settings.get_strv('hidden-providers'));
                    if (row.active)
                        next.delete(id);
                    else
                        next.add(id);
                    settings.set_strv('hidden-providers', [...next]);
                });
                if (extras.includes(id)) {
                    const remove = new Gtk.Button({icon_name: 'list-remove-symbolic',
                        valign: Gtk.Align.CENTER,
                        tooltip_text: `Remove ${sourceName(id)} from added sources`});
                    remove.connect('clicked', () => {
                        settings.set_string('extra-providers', extras
                            .filter(value => value !== id).join(','));
                        refreshSources();
                    });
                    row.add_suffix(remove);
                }
                providerGroup.add(row);
                foundRows.push(row);
            }
            if (detected.length === 0) {
                const row = new Adw.ActionRow({title: 'No sources detected',
                    subtitle: 'Choose one below to add it'});
                providerGroup.add(row);
                foundRows.push(row);
            }
            available = PROVIDER_IDS.filter(id => !detected.includes(id));
            addSource.model = Gtk.StringList.new(available.map(sourceName));
            addSource.visible = available.length > 0;
            addButton.sensitive = available.length > 0;
        };
        addGroup.add(addSource);
        addButton.connect('clicked', () => {
            const id = available[addSource.selected];
            if (!id)
                return;
            const extras = new Set(settings.get_string('extra-providers')
                .split(/[\s,]+/).filter(Boolean));
            extras.add(id);
            settings.set_string('extra-providers', [...extras].join(','));
            const hidden = new Set(settings.get_strv('hidden-providers'));
            if (hidden.delete(id))
                settings.set_strv('hidden-providers', [...hidden]);
            refreshSources();
        });
        const rescan = new Adw.ActionRow({title: 'Rescan local sources'});
        const rescanButton = new Gtk.Button({icon_name: 'view-refresh-symbolic',
            valign: Gtk.Align.CENTER, tooltip_text: 'Rescan'});
        rescan.add_suffix(rescanButton);
        rescanButton.connect('clicked', refreshSources);
        addGroup.add(rescan);
        refreshSources();

        const cli = findCli();
        const note = new Adw.ActionRow({title: cli ? 'CodexBar CLI detected' :
            'CodexBar CLI is missing', subtitle: cli ||
                'Install with: brew install steipete/tap/codexbar'});
        addGroup.add(note);
        if (!cli)
            note.add_suffix(new Gtk.LinkButton({label: 'Install guide',
                uri: 'https://github.com/steipete/CodexBar#install'}));
    }
}
