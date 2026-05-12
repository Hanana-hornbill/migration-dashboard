/*global QUnit*/

sap.ui.define([
	"migrationdashboard/migrationdashboard/controller/xml.controller"
], function (Controller) {
	"use strict";

	QUnit.module("xml Controller");

	QUnit.test("I should test the xml controller", function (assert) {
		var oAppController = new Controller();
		oAppController.onInit();
		assert.ok(oAppController);
	});

});
