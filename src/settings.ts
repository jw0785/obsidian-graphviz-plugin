import { App, PluginSettingTab, Setting } from 'obsidian';
import type GraphvizPlugin from './main';

export interface GraphvizSettings {
	dotPath: string;
}

export const DEFAULT_SETTINGS: GraphvizSettings = {
	dotPath: 'dot',
};

export class GraphvizSettingTab extends PluginSettingTab {
	plugin: GraphvizPlugin;

	constructor(app: App, plugin: GraphvizPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		new Setting(containerEl)
			.setName('Dot executable path')
			.setDesc('Path to the Graphviz dot binary, or just "dot" if it is in PATH')
			.addText((text) =>
				text
					.setPlaceholder('dot')
					.setValue(this.plugin.settings.dotPath)
					.onChange(async (value) => {
						this.plugin.settings.dotPath = value;
						await this.plugin.saveSettings();
					}),
			);
	}
}
