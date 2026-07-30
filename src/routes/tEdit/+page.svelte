<script lang="ts">
	import Title from '/src/components/Title.svelte';

	interface ElementData {
		header: string; // "node 123", "way 456", "relation 789"
		structuralLines: string[]; // Помним nd, members и техните роли
		tags: Record<string, string>;
	}

	let inputData = $state('');
	let isLocked = $state(false);
	let elements = $state<ElementData[]>([]);
	
	// Активните колони като текстов низ, разделен със запетаи
	let activeKeysText = $state('');
	let selectedDropdownTag = $state('');

	// 1. Парсиране на Level0 данни (разделяне на структури от тагове)
	function parseLevel0(data: string): ElementData[] {
		const lines = data.split('\n');
		const parsed: ElementData[] = [];
		let current: ElementData | null = null;

		for (let line of lines) {
			const trimmed = line.trim();
			if (!trimmed) continue;

			// Линия с заглавие на елемент (node, way, relation)
			if (/^(node|way|relation)\b/i.test(trimmed)) {
				if (current) parsed.push(current);
				current = { header: trimmed, structuralLines: [], tags: {} };
			} else if (current) {
				if (trimmed.includes('=')) {
					// Таг (key = val)
					const eqIdx = trimmed.indexOf('=');
					const key = trimmed.slice(0, eqIdx).trim();
					const val = trimmed.slice(eqIdx + 1).trim();
					current.tags[key] = val;
				} else {
					// Геометрия/Структура: `nd 123` за way или `way 123 outer` за relation
					current.structuralLines.push(trimmed);
				}
			}
		}
		if (current) parsed.push(current);
		return parsed;
	}

	// 2. Зареждане на данните и заключване на входа
	function handleLoad() {
		if (!inputData.trim()) return;
		elements = parseLevel0(inputData);
		isLocked = true;

		// Автоматично активираме всички уникални тагове първоначално
		const keysSet = new Set<string>();
		for (const el of elements) {
			for (const key of Object.keys(el.tags)) {
				keysSet.add(key);
			}
		}
		activeKeysText = '';
	}

	function handleUnlock() {
		isLocked = false;
	}

    function evaluateTemplate(template: string, el: ElementData): string {
        // 1. Обработка на масиви в квадратни скоби: [tag1, tag2; separator]
        let result = template.replace(/\[([^\]]+)\]/g, (match, content) => {
            let tagsPart = content;
            let separator = ' '; // Разделител по подразбиране (интервал)

            // Проверка дали има дефиниран разделител за сглобяването след ';'
            if (content.includes(';')) {
                const parts = content.split(';');
                tagsPart = parts[0];
                separator = parts.slice(1).join(';');
            }

            const tagNames = tagsPart.split(',').map((t: string) => t.trim());
            const collectedValues: string[] = [];

            for (const tag of tagNames) {
                const val = el.tags[tag];
                if (val !== undefined && val.trim() !== '') {
                    // Ако стойността съдържа ';', я разделяме на отделни стойности
                    if (val.includes(';')) {
                        const subValues = val
                            .split(';')
                            .map((v) => v.trim())
                            .filter((v) => v !== '');
                        collectedValues.push(...subValues);
                    } else {
                        collectedValues.push(val.trim());
                    }
                }
            }

            return collectedValues.join(separator);
        });

        // 2. Обработка на единични тагове: {ref}
        result = result.replace(/\{([^}]+)\}/g, (match, key) => {
            const trimmedKey = key.trim();
            return el.tags[trimmedKey] ?? '';
        });

        return result;
    }

	// 3. Изчисляване на бройката за всеки таг за дропдауна
	let tagCounts = $derived.by(() => {
		const counts = new Map<string, number>();
		for (const el of elements) {
			for (const key of Object.keys(el.tags)) {
				counts.set(key, (counts.get(key) || 0) + 1);
			}
		}
		return counts;
	});

	// Списък за дропдауна: таг + бройка
	let dropdownOptions = $derived.by(() => {
		return Array.from(tagCounts.entries()).map(([key, count]) => ({
			key,
			label: `${key} (${count})`
		}));
	});

	// Масив с активните колони, получени от текстовото поле вдясно
	let activeKeys = $derived.by(() => {
		return activeKeysText
			.split(',')
			.map((s) => s.trim())
			.filter(Boolean);
	});

	// Добавяне на таг от дропдауна към активните колони
	function addTagFromDropdown() {
		if (!selectedDropdownTag) return;
		const current = activeKeys;
		if (!current.includes(selectedDropdownTag)) {
			current.push(selectedDropdownTag);
			activeKeysText = current.join(', ');
		}
		selectedDropdownTag = ''; // нулиране на избора
	}

	// 4. Генерация на Level0 изход (запазва структурата + обновява таговете)
	let outputData = $derived.by(() => {
		return elements
			.map((el) => {
				const struct = el.structuralLines.map((l) => `  ${l}`).join('\n');
				const tagLines = Object.entries(el.tags)
					.map(([k, v]) => `  ${k} = ${v}`)
					.join('\n');

				let res = el.header;
				if (tagLines) res += '\n' + tagLines;
				if (struct) res += '\n' + struct;
				return res;
			})
			.join('\n\n');
	});

	// Helper за груповото поле (Bulk Editor)
	function getBulkValue(key: string): { displayVal: string; placeholder: string } {
		const values = elements.map((el) => el.tags[key]).filter((v) => v !== undefined);
		if (values.length === 0) return { displayVal: '', placeholder: '' };

		const allSame = values.length === elements.length && values.every((v) => v === values[0]);
		if (allSame) {
			return { displayVal: values[0], placeholder: '' };
		}
		return { displayVal: '', placeholder: '*' };
	}

	function getUniqueValuesForKey(key: string): string[] {
		const set = new Set<string>();
		for (const el of elements) {
			if (el.tags[key] !== undefined) set.add(el.tags[key]);
		}
		return Array.from(set);
	}

	function updateAllForKey(key: string, rawVal: string) {
        const hasTemplate = rawVal.includes('{') || rawVal.includes('[');

        for (const el of elements) {
            const finalVal = hasTemplate ? evaluateTemplate(rawVal, el) : rawVal;

            if (finalVal === '') {
                delete el.tags[key];
            } else {
                el.tags[key] = finalVal;
            }
        }
    }

	function removeKeyFromAll(key: string) {
		for (const el of elements) {
			delete el.tags[key];
		}
		// Премахване и от активните колони
		activeKeysText = activeKeys.filter((k) => k !== key).join(', ');
	}
</script>

<Title title="Табличен редактор (OSM Level0)" />

<div class="editor-container">
	<!-- Вход / Изход секция -->
	<div class="io-section">
		<div>
			<h3>Входни данни (Level0 формат)</h3>
			<textarea
				bind:value={inputData}
				disabled={isLocked}
				placeholder="way 123&#10;  nd 11&#10;  nd 22&#10;  building = yes"
				rows="6"
			></textarea>
			{#if !isLocked}
				<button onclick={handleLoad}>Зареди данни</button>
			{:else}
				<button onclick={handleUnlock}>Отключи входа</button>
			{/if}
		</div>

		<div>
			<h3>Изходни данни (обновяват се автоматично)</h3>
			<textarea value={outputData} placeholder="Резултатът ще се обнови тук..." rows="6" readonly></textarea>
		</div>
	</div>

	{#if elements.length > 0}
		<!-- Панел за контрол на колоните (Таговете) -->
		<div class="tag-controls">
			<div class="dropdown-box">
				<label for="tag-select">Добави колона (таг):</label>
				<select
					id="tag-select"
					bind:value={selectedDropdownTag}
					onchange={addTagFromDropdown}
				>
					<option value="">-- Изберете таг --</option>
					{#each dropdownOptions as opt}
						<option value={opt.key}>{opt.label}</option>
					{/each}
				</select>
			</div>

			<div class="active-tags-box">
				<label for="active-tags-input">Видими тагове (редактирайте с запетая):</label>
				<input
					id="active-tags-input"
					type="text"
					bind:value={activeKeysText}
					placeholder="напр. name, building, highway"
				/>
			</div>
		</div>

		<!-- Таблица -->
		<div class="table-wrapper">
			<table>
				<thead>
					<!-- Заглавия на колоните -->
					<tr>
						<th class="col-element">Елемент / Геометрия</th>
						{#each activeKeys as key}
							<th class="col-tag">
								<div class="key-header">
									<span>{key}</span>
									<button
										class="btn-danger"
										onclick={() => removeKeyFromAll(key)}
										title="Изтрий тага от всички"
									>
										✕
									</button>
								</div>
							</th>
						{/each}
					</tr>

					<!-- Ред за групова промяна (Bulk Input) -->
					<tr class="bulk-row">
						<td><em>Промяна на всички (*)</em></td>
						{#each activeKeys as key}
							{@const bulkInfo = getBulkValue(key)}
							<td>
								<input
									type="text"
									class="cell-input"
									list="list-{key}"
									value={bulkInfo.displayVal}
									placeholder={bulkInfo.placeholder}
									onchange={(e) => updateAllForKey(key, e.currentTarget.value)}
								/>
								<datalist id="list-{key}">
									{#each getUniqueValuesForKey(key) as opt}
										<option value={opt}></option>
									{/each}
								</datalist>
							</td>
						{/each}
					</tr>
				</thead>

				<tbody>
					{#each elements as el}
						<tr>
							<!-- Първа колона: Вид елемент и неговите неизменяеми възли/членове -->
							<td class="element-info">
								<strong>{el.header}</strong>
								{#if el.structuralLines.length > 0}
									<div class="struct-summary">
										{el.structuralLines.join(' | ')}
									</div>
								{/if}
							</td>

							<!-- Колони за таговете -->
							{#each activeKeys as key}
								<td>
									<input
										type="text"
										class="cell-input"
										value={el.tags[key] ?? ''}
										onchange={(e) => {
                                            let val = e.currentTarget.value;
                                            
                                            // Проверяваме за {tag} или [tag1, tag2]
                                            if (val.includes('{') || val.includes('[')) {
                                                val = evaluateTemplate(val, el);
                                                e.currentTarget.value = val;
                                            }

                                            if (val === '') {
                                                delete el.tags[key];
                                            } else {
                                                el.tags[key] = val;
                                            }
                                        }}
									/>
								</td>
							{/each}
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/if}
</div>

<style>
	.editor-container {
		display: flex;
		flex-direction: column;
		gap: 1.2rem;
		padding: 1rem;
		font-family: sans-serif;
	}
	.io-section {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 1rem;
	}
	textarea {
		width: 100%;
		font-family: monospace;
		box-sizing: border-box;
	}
	
	/* Контролен панел за таговете */
	.tag-controls {
		display: flex;
		gap: 1.5rem;
		background: #f8fafc;
		border: 1px solid #cbd5e1;
		padding: 0.8rem 1rem;
		border-radius: 6px;
		align-items: center;
	}
	.dropdown-box, .active-tags-box {
		display: flex;
		flex-direction: column;
		gap: 0.3rem;
	}
	.dropdown-box {
		flex: 1;
	}
	.active-tags-box {
		flex: 2;
	}
	.active-tags-box input, .dropdown-box select {
		padding: 0.4rem 0.6rem;
		font-size: 0.95rem;
		border: 1px solid #94a3b8;
		border-radius: 4px;
	}

	/* Настройки на таблицата */
	.table-wrapper {
		overflow-x: auto;
		border: 1px solid #cbd5e1;
		border-radius: 6px;
	}
	table {
		width: 100%;
		border-collapse: collapse;
		min-width: 600px;
	}
	th, td {
		border: 1px solid #cbd5e1;
		padding: 0.5rem;
		vertical-align: top;
	}
	.col-element {
		min-width: 180px;
		background-color: #f1f5f9;
	}
	.col-tag {
		min-width: 220px; /* По-широки колони за текстовите кутии */
		background-color: #f8fafc;
	}
	.element-info {
		background-color: #fafafa;
		font-size: 0.9rem;
	}
	.struct-summary {
		font-size: 0.75rem;
		color: #64748b;
		margin-top: 4px;
		max-height: 40px;
		overflow-y: auto;
		font-family: monospace;
	}
	
	/* Текстовите кутии в клетките */
	.cell-input {
		width: 100%;
		box-sizing: border-box;
		padding: 0.4rem 0.5rem;
		font-size: 0.95rem;
		border: 1px solid #cbd5e1;
		border-radius: 4px;
	}
	.cell-input:focus {
		border-color: #2563eb;
		outline: none;
		background-color: #eff6ff;
	}
	
	.bulk-row {
		background-color: #f0fdf4;
	}
	.key-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		font-weight: bold;
	}
	.btn-danger {
		background: none;
		border: none;
		color: #ef4444;
		cursor: pointer;
		font-weight: bold;
		font-size: 1rem;
	}
	.btn-danger:hover {
		color: #b91c1c;
	}
</style>