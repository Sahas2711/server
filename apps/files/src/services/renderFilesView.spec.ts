/**
 * SPDX-FileCopyrightText: 2026 Nextcloud GmbH and Nextcloud contributors
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import type RouterService from './RouterService.ts'

import { getNavigation, View } from '@nextcloud/files'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { h } from 'vue'
import { renderFilesView } from './renderFilesView.ts'

const VIEW_ID = 'test-view'
const renderedViews: Array<ReturnType<typeof renderFilesView>> = []

function mountFilesView(el: HTMLElement) {
	const rendered = renderFilesView(el, VIEW_ID)
	renderedViews.push(rendered)
	return rendered
}

vi.mock('../views/FilesList.vue', () => ({
	default: {
		name: 'FilesList',
		props: { embedded: { type: Boolean, default: false } },
		render() {
			return h('div', { id: 'files-list-stub', 'data-embedded': String(this.embedded) })
		},
	},
}))

describe('renderFilesView', () => {
	beforeEach(() => {
		document.body.innerHTML = ''
		window.OCP = { Files: { Router: {} as RouterService } } as unknown as typeof window.OCP
		renderedViews.length = 0
		getNavigation().register(new View({
			id: VIEW_ID,
			name: 'Test view',
			icon: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M0 0h24v24H0z" /></svg>',
			getContents: async () => ({ folder: {} as never, contents: [] }),
		}))
	})

	afterEach(() => {
		for (const rendered of renderedViews) {
			rendered.destroy()
		}
		getNavigation().remove(VIEW_ID)
	})

	it('mounts only the file list, embedded, into the given element', async () => {
		const el = document.createElement('div')
		document.body.appendChild(el)

		mountFilesView(el)

		const stub = await vi.waitFor(() => {
			const stub = document.body.querySelector('#files-list-stub')
			expect(stub).not.toBeNull()
			return stub
		})
		expect(stub?.getAttribute('data-embedded')).toBe('true')
	})

	it('activates the requested view without touching the browser URL', () => {
		const el = document.createElement('div')
		document.body.appendChild(el)
		const before = window.location.href

		mountFilesView(el)

		expect(window.location.href).toBe(before)
		expect(getNavigation().active?.id).toBe(VIEW_ID)
	})

	it('routes embedded navigation in memory and restores the previous router on destroy', async () => {
		const el = document.createElement('div')
		document.body.appendChild(el)
		const previousRouter = window.OCP.Files.Router
		const before = window.location.href

		const rendered = mountFilesView(el)
		await window.OCP.Files.Router.goToRoute('filelist', { view: VIEW_ID })

		expect(window.location.href).toBe(before)
		expect(window.OCP.Files.Router).not.toBe(previousRouter)

		rendered.destroy()
		expect(window.OCP.Files.Router).toBe(previousRouter)
	})

	it('returns a handle that unmounts the file list', async () => {
		const el = document.createElement('div')
		document.body.appendChild(el)

		const rendered = mountFilesView(el)
		await vi.waitFor(() => expect(document.body.querySelector('#files-list-stub')).not.toBeNull())
		rendered.destroy()

		expect(document.body.querySelector('#files-list-stub')).toBeNull()
	})

	it('rejects another embed while one is active and allows one after destroy', () => {
		const firstEl = document.createElement('div')
		const secondEl = document.createElement('div')
		document.body.append(firstEl, secondEl)
		const previousRouter = window.OCP.Files.Router
		const rendered = mountFilesView(firstEl)
		const embeddedRouter = window.OCP.Files.Router

		expect(() => renderFilesView(secondEl, VIEW_ID)).toThrow('Only one embedded Files view can be active at a time')
		expect(window.OCP.Files.Router).toBe(embeddedRouter)

		rendered.destroy()
		expect(window.OCP.Files.Router).toBe(previousRouter)
		const secondRendered = mountFilesView(secondEl)
		secondRendered.destroy()
	})
})
