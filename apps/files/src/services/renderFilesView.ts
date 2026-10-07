/**
 * SPDX-FileCopyrightText: 2026 Nextcloud GmbH and Nextcloud contributors
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { getNavigation } from '@nextcloud/files'
import { createApp, defineAsyncComponent } from 'vue'
import { createMemoryHistory } from 'vue-router'
import { createFilesRouter } from '../router/router.ts'
import { pinia } from '../store/index.ts'
import RouterService from './RouterService.ts'

let activeRouterService: RouterService | undefined

/** Handle returned by `renderFilesView()` to tear down the embedded instance. */
export interface RenderedFilesView {
	/** Unmount the file list and free the DOM node it was rendered into. */
	destroy: () => void
}

/**
 * Render only the Files file list (breadcrumbs, toolbar, file list) into a
 * foreign DOM element, activating the given Files navigation view.
 *
 * This never renders `NcContent` or `NcAppContent` - those belong to the
 * Files app's own page chrome (see `FilesApp.vue`) and are skipped here so
 * the file list can be embedded as a widget inside another app's page.
 *
 * The host page must dispatch `OCA\Files\Event\LoadFilesApp` server-side
 * beforehand so the Files app's scripts and initial state are loaded, and
 * the target view must already be registered via `getNavigation().register()`.
 *
 * Exposed as `OCP.Files.renderFilesApp()`.
 * Only one embedded Files view can be active at a time.
 *
 * @param el the element to mount the file list into
 * @param viewId the id of the Files navigation view to display
 */
export function renderFilesView(el: HTMLElement, viewId: string): RenderedFilesView {
	if (activeRouterService) {
		throw new Error('Only one embedded Files view can be active at a time')
	}

	const router = createFilesRouter(createMemoryHistory())
	const previousRouterService = window.OCP.Files.Router
	const routerService = new RouterService(router)
	// Lazy-loaded like in the router, so its CSS is applied after the shared component styles
	const FilesList = defineAsyncComponent(() => import('../views/FilesList.vue').then((module) => module.default))
	const app = createApp(FilesList, { embedded: true })
	app.use(pinia)
	app.use(router)
	window.OCP.Files.Router = routerService
	activeRouterService = routerService
	try {
		app.mount(el)
	} catch (error) {
		window.OCP.Files.Router = previousRouterService
		activeRouterService = undefined
		throw error
	}

	// Normally done by the navigation sidebar's route watcher; there is none
	// here, so keep the active view in sync ourselves.
	getNavigation().setActive(viewId)
	void router.push({ name: 'filelist', params: { view: viewId } }).catch(() => {})

	return {
		destroy: () => {
			if (activeRouterService !== routerService) {
				return
			}

			app.unmount()
			if (window.OCP.Files.Router === routerService) {
				window.OCP.Files.Router = previousRouterService
			}
			activeRouterService = undefined
		},
	}
}
