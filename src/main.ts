import { Notice, Platform, Plugin, setIcon } from 'obsidian';
import { execFile } from 'child_process';
import { existsSync } from 'fs';
import {
	DEFAULT_SETTINGS,
	GraphvizSettings,
	GraphvizSettingTab,
} from './settings';

const MAX_CACHE = 100;

export default class GraphvizPlugin extends Plugin {
	settings!: GraphvizSettings;
	private cache = new Map<string, string>();
	resolvedDotPath: string | null = null;

	async onload() {
		await this.loadSettings();
		this.addSettingTab(new GraphvizSettingTab(this.app, this));
		await this.resolveDotPath();

		const handler = (source: string, el: HTMLElement) => {
			if (!this.resolvedDotPath) {
				el.createEl('pre', {
					text: 'Graphviz error: dot binary not found. Set the path in plugin settings.',
				});
				return;
			}

			const cached = this.cache.get(source);
			if (cached) {
				this.injectSvg(el, cached);
				return;
			}

			this.renderDot(source)
				.then((svg) => {
					this.evict();
					this.cache.set(source, svg);
					this.injectSvg(el, svg);
				})
				.catch((err: Error) => {
					el.createEl('pre', {
						text: `Graphviz error: ${err.message}`,
					});
				});
		};

		this.registerMarkdownCodeBlockProcessor('dot', handler);
		this.registerMarkdownCodeBlockProcessor('graphviz', handler);
	}

	async resolveDotPath() {
		if (this.settings.dotPath !== DEFAULT_SETTINGS.dotPath) {
			this.resolvedDotPath = this.settings.dotPath;
			return;
		}

		const found = (await this.findInPath()) ?? this.findInKnownLocations();
		if (found) {
			this.resolvedDotPath = found;
			this.settings.dotPath = found;
			await this.saveSettings();
		} else {
			new Notice(
				'Graphviz: dot binary not found in PATH. Set it manually in plugin settings.',
			);
		}
	}

	private findInPath(): Promise<string | null> {
		const cmd = Platform.isWin ? 'where' : 'which';
		return new Promise((resolve) => {
			execFile(cmd, ['dot'], (err, stdout) => {
				if (err) {
					resolve(null);
					return;
				}
				resolve(stdout.trim().split('\n')[0]!.trim());
			});
		});
	}

	private findInKnownLocations(): string | null {
		const candidates: string[] = [];
		if (Platform.isWin) {
			candidates.push('C:\\Program Files\\Graphviz\\bin\\dot.exe');
		} else if (Platform.isMacOS) {
			candidates.push('/opt/homebrew/bin/dot', '/usr/local/bin/dot');
		}
		return candidates.find((p) => existsSync(p)) ?? null;
	}

	private injectSvg(el: HTMLElement, svg: string) {
		const container = el.createDiv({ cls: 'graphviz-container graphviz-fit' });
		const img = container.createEl('img', { cls: 'graphviz-svg' });
		img.src = `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;

		const btn = container.createEl('button', { cls: 'graphviz-toggle' });
		setIcon(btn, 'maximize-2');
		btn.addEventListener('click', () => {
			const isFit = container.hasClass('graphviz-fit');
			container.toggleClass('graphviz-fit', !isFit);
			container.toggleClass('graphviz-overflow', isFit);
			setIcon(btn, isFit ? 'minimize-2' : 'maximize-2');
		});
	}

	private renderDot(source: string): Promise<string> {
		return new Promise((resolve, reject) => {
			const proc = execFile(
				this.resolvedDotPath!,
				['-Tsvg'],
				{ timeout: 10000 },
				(err, stdout, stderr) => {
					if (err) {
						reject(new Error(stderr || err.message));
						return;
					}
					resolve(stdout);
				},
			);
			proc.stdin?.write(source);
			proc.stdin?.end();
		});
	}

	private evict() {
		while (this.cache.size >= MAX_CACHE) {
			const oldest = this.cache.keys().next().value;
			if (oldest !== undefined) this.cache.delete(oldest);
		}
	}

	onunload() {}

	async loadSettings() {
		this.settings = Object.assign(
			{},
			DEFAULT_SETTINGS,
			(await this.loadData()) as Partial<GraphvizSettings>,
		);
	}

	async saveSettings() {
		await this.saveData(this.settings);
		this.resolvedDotPath = this.settings.dotPath || null;
	}
}
