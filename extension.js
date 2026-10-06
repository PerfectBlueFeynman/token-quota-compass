// Generated with AI for personal use.
// Do NOT upload to extensions.gnome.org (EGO) unless you understand JavaScript
// and can maintain this code.
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import St from 'gi://St';
import Clutter from 'gi://Clutter';
import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
import {discoverProviders, findCli} from './discovery.js';
import {queryProvider} from './client.js';
import {featuredWindow, resetText} from './normalize.js';

const NAMES = {codex: 'Codex', claude: 'Claude', opencode: 'OpenCode',
    opencodego: 'OpenCode Go', gemini: 'Gemini', copilot: 'Copilot'};
const LOGOS = new Set(['antigravity', 'claude', 'codex', 'copilot',
    'deepseek', 'gemini', 'mistral', 'ollama', 'opencode', 'opencodego',
    'openrouter', 'perplexity']);
const LOGO_ALIASES = {openai: 'codex', 'azure-openai': 'codex',
    'vertexai': 'gemini'};

function percentText(window, remaining) {
    if (window.used > 100)
        return `+${Math.round(window.used - 100)}% over`;
    const value = remaining ? 100 - window.used : window.used;
    return `${Math.round(value)}%`;
}

function panelPercentText(window, remaining) {
    if (window.used > 100)
        return `+${Math.round(window.used - 100)}%`;
    return `${Math.round(remaining ? 100 - window.used : window.used)}%`;
}

function panelExtraText(value) {
    const match = /^\+([\d.]+) (USD|EUR|GBP)$/.exec(value);
    if (!match)
        return value;
    const symbols = {USD: '$', EUR: '€', GBP: '£'};
    return `+${symbols[match[2]]}${match[1]}`;
}

export default class TokenQuotaCompass extends Extension {
    enable() {
        this._settings = this.getSettings();
        this._indicator = new PanelMenu.Button(0.0, 'Token Quota Compass');
        this._indicator.menu.box.add_style_class_name('tqc-menu');
        this._indicator.menu._boxPointer.bin.set_child(null);
        this._menuShell = new St.BoxLayout({vertical: true,
            style_class: 'tqc-menu-shell'});
        this._menuHeader = new St.BoxLayout({vertical: true,
            style_class: 'tqc-header'});
        this._menuShell.add_child(this._menuHeader);
        this._menuScroll = new St.ScrollView({style_class: 'tqc-menu-scroll',
            vscrollbar_policy: St.PolicyType.AUTOMATIC,
            child: this._indicator.menu.box});
        this._menuShell.add_child(this._menuScroll);
        this._indicator.menu._boxPointer.bin.set_child(this._menuShell);
        this._panel = new St.BoxLayout({style_class: 'tqc-panel',
            y_align: Clutter.ActorAlign.CENTER});
        this._indicator.add_child(this._panel);
        Main.panel.addToStatusArea(this.uuid, this._indicator, 0, 'center');
        this._placeIndicator();

        this._generation = 0;
        this._results = new Map();
        this._cancellable = null;
        this._timer = 0;
        this._resetLabels = [];
        this._countdownTimer = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT,
            60, () => {
                this._updateResetLabels();
                return GLib.SOURCE_CONTINUE;
            });
        this._menuOpenId = this._indicator.menu.connect('open-state-changed',
            (_menu, isOpen) => {
                if (isOpen)
                    this._updateResetLabels();
            });
        this._signalIds = [
            this._settings.connect('changed::refresh-minutes', () => this._schedule()),
            this._settings.connect('changed::extra-providers', () => this._refresh()),
            this._settings.connect('changed::hidden-providers', () => this._refresh()),
            this._settings.connect('changed::show-remaining', () => this._render()),
            this._settings.connect('changed::show-sources-in-bar', () => this._render()),
            this._settings.connect('changed::show-all-sources', () => this._render()),
            this._settings.connect('changed::panel-position', () => this._placeIndicator()),
        ];
        this._refresh();
        this._schedule();
    }

    _placeIndicator() {
        const position = this._settings.get_string('panel-position');
        const boxes = {
            left: Main.panel._leftBox,
            'center-left': Main.panel._centerBox,
            'center-right': Main.panel._centerBox,
            right: Main.panel._rightBox,
        };
        const box = boxes[position] || Main.panel._centerBox;
        const container = this._indicator.container;
        const parent = container.get_parent();
        if (parent)
            parent.remove_child(container);

        let index = 0;
        if (position === 'left') {
            index = -1;
        } else if (position.startsWith('center-')) {
            const date = Main.panel.statusArea.dateMenu?.container;
            const dateIndex = date ? box.get_children().indexOf(date) : -1;
            index = dateIndex < 0 ? (position === 'center-right' ? -1 : 0)
                : dateIndex + (position === 'center-right' ? 1 : 0);
        }
        box.insert_child_at_index(container, index);
    }

    disable() {
        this._generation++;
        this._cancellable?.cancel();
        this._cancellable = null;
        if (this._timer)
            GLib.Source.remove(this._timer);
        this._timer = 0;
        if (this._countdownTimer)
            GLib.Source.remove(this._countdownTimer);
        this._countdownTimer = 0;
        this._indicator.menu.disconnect(this._menuOpenId);
        this._menuOpenId = 0;
        for (const id of this._signalIds || [])
            this._settings.disconnect(id);
        this._signalIds = [];
        this._indicator?.destroy();
        this._indicator = null;
        this._menuShell = null;
        this._menuHeader = null;
        this._menuScroll = null;
        this._settings = null;
        this._resetLabels = null;
        this._results = null;
        this._providers = null;
        this._cli = null;
    }

    _schedule() {
        if (this._timer)
            GLib.Source.remove(this._timer);
        const minutes = Math.max(2, Math.min(120,
            this._settings.get_int('refresh-minutes')));
        this._timer = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT,
            minutes * 60, () => {
                this._refresh();
                return GLib.SOURCE_CONTINUE;
            });
    }

    async _refresh() {
        const generation = ++this._generation;
        this._cancellable?.cancel();
        const cancellable = new Gio.Cancellable();
        this._cancellable = cancellable;
        const hidden = new Set(this._settings.get_strv('hidden-providers'));
        const providers = discoverProviders(this._settings.get_string('extra-providers'))
            .filter(id => !hidden.has(id));
        this._providers = providers;
        this._cli = findCli();
        if (!this._cli || providers.length === 0) {
            this._render();
            return;
        }
        this._render();
        let next = 0;
        const worker = async () => {
            while (next < providers.length && generation === this._generation) {
                const provider = providers[next++];
                try {
                    const accounts = await queryProvider(this._cli, provider, cancellable);
                    if (generation === this._generation)
                        this._results.set(provider, accounts.length ? accounts : [{
                            id: provider, account: '', windows: [], error: 'No accounts',
                        }]);
                } catch (_error) {
                    if (generation === this._generation) {
                        const messages = {
                            CLAUDE_LOGIN_REQUIRED: 'Claude signed out · run claude auth login',
                            CLAUDE_SOURCE_UNAVAILABLE: 'Claude source unavailable · check Claude login',
                        };
                        this._results.set(provider, [{id: provider, account: '',
                            windows: [], error: messages[_error.code] || 'Usage unavailable'}]);
                    }
                }
                if (generation === this._generation)
                    this._render();
            }
        };
        await Promise.allSettled(Array.from({length: Math.min(3, providers.length)},
            () => worker()));
        if (generation === this._generation)
            this._cancellable = null;
    }

    _render() {
        if (!this._indicator)
            return;
        this._panel.destroy_all_children();
        this._resetLabels = [];
        this._indicator.menu.removeAll();
        this._shownChips = 0;
        this._hiddenChips = 0;
        const remaining = this._settings.get_boolean('show-remaining');
        const showInBar = this._settings.get_boolean('show-sources-in-bar');
        const providers = this._providers || [];
        this._renderHeader(remaining, providers.length);
        if (!this._cli) {
            if (showInBar)
                this._panel.add_child(new St.Label({text: 'Quota · !'}));
            this._addNotice('CodexBar CLI missing · open Settings for install steps');
            const install = new PopupMenu.PopupMenuItem('Copy CodexBar CLI install command');
            install.add_style_class_name('tqc-action');
            install.connect('activate', () => {
                St.Clipboard.get_default().set_text(St.ClipboardType.CLIPBOARD,
                    'brew install steipete/tap/codexbar');
            });
            this._indicator.menu.addMenuItem(install);
        } else if (providers.length === 0) {
            if (showInBar)
                this._panel.add_child(new St.Label({text: 'Quota · —'}));
            this._addNotice('No local providers found');
        } else {
            for (const provider of providers) {
                const accounts = this._results.get(provider) || [];
                if (accounts.length === 0) {
                    if (showInBar)
                        this._appendPanel(provider, '…', false);
                    this._renderAccount(provider, {account: '', windows: [],
                        extras: [], error: 'Checking usage…'}, remaining);
                    continue;
                }
                for (const account of accounts) {
                    const feature = featuredWindow(account.windows);
                    const overage = account.extras?.find(row => row.panelValue);
                    const value = overage ? panelExtraText(overage.panelValue) : feature
                        ? panelPercentText(feature, remaining) : '—';
                    if (showInBar)
                        this._appendPanel(provider, value, !!account.error || !!overage,
                            feature ? 100 - feature.used : null);
                    this._renderAccount(provider, account, remaining);
                }
            }
        }
        if (!showInBar)
            this._panel.add_child(new St.Icon({icon_name: 'view-grid-symbolic',
                icon_size: 16, accessible_name: 'Token Quota Compass'}));
        if (this._hiddenChips)
            this._panel.add_child(new St.Label({text: `+${this._hiddenChips}`,
                style_class: 'tqc-chip'}));
    }

    _renderHeader(remaining, count) {
        this._menuHeader.destroy_all_children();
        const top = new St.BoxLayout({style_class: 'tqc-header-top'});
        top.add_child(new St.Label({text: 'Quota overview',
            style_class: 'tqc-heading', x_expand: true}));
        const actions = new St.BoxLayout({style_class: 'tqc-header-actions'});
        const refresh = new St.Button({style_class: 'tqc-header-button',
            accessible_name: 'Refresh now', can_focus: true,
            child: new St.Icon({icon_name: 'view-refresh-symbolic', icon_size: 16})});
        refresh.connect('clicked', () => this._refresh());
        actions.add_child(refresh);
        const settings = new St.Button({style_class: 'tqc-header-button',
            accessible_name: 'Settings', can_focus: true,
            child: new St.Icon({icon_name: 'emblem-system-symbolic', icon_size: 16})});
        settings.connect('clicked', () => this.openPreferences());
        actions.add_child(settings);
        top.add_child(actions);
        this._menuHeader.add_child(top);
        this._menuHeader.add_child(new St.Label({
            text: `${count} providers · ${remaining ? 'remaining' : 'used'} quota`,
            style_class: 'tqc-muted'}));
    }

    _addNotice(message) {
        const item = new PopupMenu.PopupMenuItem(message, {reactive: false});
        item.add_style_class_name('tqc-notice');
        this._indicator.menu.addMenuItem(item);
    }

    _providerIcon(provider, styleClass, size) {
        const name = LOGO_ALIASES[provider] || provider;
        const file = Gio.File.new_for_path(GLib.build_filenamev(
            [this.path, 'media', 'logos', `${name}-symbolic.svg`]));
        const icon = LOGOS.has(name) && file.query_exists(null)
            ? new St.Icon({
                gicon: Gio.FileIcon.new(file),
                icon_size: size,
                style_class: styleClass,
            })
            : new St.Icon({icon_name: 'system-run-symbolic',
                icon_size: size, style_class: styleClass});
        icon.accessible_name = NAMES[provider] || provider;
        return icon;
    }

    _renderAccount(provider, account, remaining) {
        const item = new PopupMenu.PopupBaseMenuItem({reactive: false});
        item.add_style_class_name('tqc-card-item');
        const card = new St.BoxLayout({vertical: true, style_class: 'tqc-card',
            x_expand: true});
        item.add_child(card);
        const title = new St.BoxLayout({style_class: 'tqc-card-title'});
        title.add_child(this._providerIcon(provider, 'tqc-card-icon', 18));
        title.add_child(new St.Label({text: NAMES[provider] || provider,
            style_class: 'tqc-provider-name', x_expand: true}));
        if (account.error)
            title.add_child(new St.Label({text: 'UNAVAILABLE',
                style_class: 'tqc-status-error'}));
        card.add_child(title);
        if (account.account)
            card.add_child(new St.Label({text: account.account,
                style_class: 'tqc-account'}));
        if (account.error && !account.windows?.length) {
            card.add_child(new St.Label({text: account.error,
                style_class: 'tqc-muted'}));
        } else {
            for (const window of account.windows || [])
                this._renderWindow(card, window, remaining);
            if (!account.windows?.length)
                card.add_child(new St.Label({text: 'No quota window reported',
                    style_class: 'tqc-muted'}));
        }
        if (account.extras?.length) {
            card.add_child(new St.Label({text: 'CREDITS, SPEND & PACE',
                style_class: 'tqc-section-label'}));
            for (const row of account.extras)
                this._renderExtra(card, row);
        }
        this._indicator.menu.addMenuItem(item);
    }

    _renderWindow(card, window, remaining) {
        const line = new St.BoxLayout({style_class: 'tqc-window-line'});
        line.add_child(new St.Label({text: window.name,
            style_class: 'tqc-window-name', x_expand: true}));
        line.add_child(new St.Label({text: percentText(window, remaining),
            style_class: window.used > 100 ? 'tqc-value-over' : 'tqc-window-value'}));
        card.add_child(line);
        const trackWidth = 300;
        const track = new St.BoxLayout({
            style_class: window.used > 100 ? 'tqc-meter tqc-meter-over' : 'tqc-meter',
            width: trackWidth,
        });
        const displayed = window.used > 100 ? 100 : remaining
            ? Math.max(0, 100 - window.used) : Math.min(100, window.used);
        const width = Math.round(displayed / 100 * trackWidth);
        if (width > 0)
            track.add_child(new St.Widget({width, height: 5,
                style_class: window.used > 100 ? 'tqc-fill-over' : 'tqc-fill'}));
        if (width < trackWidth)
            track.add_child(new St.Widget({width: trackWidth - width, height: 5}));
        card.add_child(track);
        const reset = resetText(window.resetsAt);
        if (reset) {
            const label = new St.Label({text: reset, style_class: 'tqc-reset-time'});
            card.add_child(label);
            this._resetLabels.push({label, value: window.resetsAt});
        }
    }

    _updateResetLabels() {
        for (const {label, value} of this._resetLabels)
            label.text = resetText(value);
    }

    _renderExtra(card, row) {
        const line = new St.BoxLayout({style_class: 'tqc-extra-line'});
        line.add_child(new St.Label({text: row.label,
            style_class: 'tqc-extra-label', x_expand: true}));
        line.add_child(new St.Label({text: row.value,
            style_class: row.alert ? 'tqc-value-over' : 'tqc-extra-value'}));
        card.add_child(line);
        if (row.detail)
            card.add_child(new St.Label({text: row.detail, style_class: 'tqc-reset'}));
    }

    _appendPanel(provider, value, error, remaining = null) {
        if (!this._settings.get_boolean('show-all-sources') && this._shownChips >= 4) {
            this._hiddenChips++;
            return;
        }
        this._shownChips++;
        let style = 'tqc-chip';
        if (error)
            style += ' tqc-error';
        else if (remaining !== null && remaining <= 10)
            style += ' tqc-critical';
        else if (remaining !== null && remaining <= 25)
            style += ' tqc-warning';
        const chip = new St.BoxLayout({style_class: style,
            y_align: Clutter.ActorAlign.CENTER});
        chip.add_child(this._providerIcon(provider, 'tqc-chip-icon', 13));
        chip.add_child(new St.Label({text: value,
            style_class: 'tqc-chip-value'}));
        this._panel.add_child(chip);
    }
}
