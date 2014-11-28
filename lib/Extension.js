!function() {
    'use strict';


    var   Class         = require('ee-class')
        , log           = require('ee-log')
        , type          = require('ee-types')
        , async         = require('ee-async')
        , ORMExtension  = require('ee-orm-extension');


    var   thisContext
        , ORM;


    module.exports = new Class({
        inherits: ORMExtension

        , languageTable: 'language'
        , codeField: 'code'


        , _name: 'localized'


        , init: function init(options) {
            init.super.call(this);

            // we need to build queries
            this.orm = options.orm;

            // store this context so we'll have acces in some 
            // methods attached to the model
            thisContext = this;

            // get the orm object
            if (!ORM) ORM = this.orm.getORM();

            // storage
            this._storage = {};

            // the user may define the name of the language table
            if (options && options.languageTable)   this.languageTable  = options.languageTable;
            if (options && options.codeField)       this.codeField      = options.codeField;
        }


        /*
         * we have to add our locale queries (sub selects)
         */
        , onBeforePrepareSubqueries: function(resource, definition) {
            if (!resource.getDefinition().isLocalizedTable) return;

            // we need to check if we nede to get the language data
            resource.getQuery().select.some(function(selection) {
                if (this._storage[resource.databaseName] && this._storage[resource.databaseName][resource.name]) {
                    if (selection === '*') {
                        // we need to select the language table, all fieds
                        Object.keys(this._storage[resource.databaseName][resource.name]).forEach(function(columnName) {
                             this._addSubSelect(columnName, resource);
                        }.bind(this));

                        // stop, we've already selected everything
                        return true;
                    }
                    else if (this._storage[resource.databaseName][resource.name][selection]) {
                        // specific field was selected
                        this._addSubSelect(selection, resource);
                    }
                }
            }.bind(this));
        }



        , onBeforePrepare: function(resource, definition) {
            if (!resource.getDefinition().isLocalizedTable) return;

            thisContext.onBeforePrepareSubqueries(resource, definition);
        }




        , _addSubSelect: function(fieldName, resource) {
            if (!resource.getDefinition().isLocalizedTable) return;

            var   definition        = this._storage[resource.databaseName][resource.name][fieldName]
                , mappingName       = definition.mappingName
                , referencingColumn = definition.referencingColumn
                , referencedColumn  = definition.referencedColumn
                , languageSelection = this._getLanguageSelection(resource)
                , mappingFilter
                , filter;


            if (languageSelection && (!resource._localizedSelection || !resource._localizedSelection[fieldName])) {
                if (!resource._localizedSelection) resource._localizedSelection = {};
                resource._localizedSelection[fieldName] = true;

                filter = {};
                filter[this.codeField] = ORM.in(languageSelection);

                mappingFilter = {};
                mappingFilter[referencingColumn] = ORM.reference(resource.name, referencedColumn);
                mappingFilter[fieldName] = ORM.notNull();

                resource.selectColumn({
                      query: this.orm[resource.databaseName][mappingName]([fieldName], mappingFilter).limit(1).get(this.languageTable, filter).orderRoot(this.codeField, false, languageSelection)
                    , alias: fieldName
                });
            }
        }


        , _getLanguageSelection: function(resource) {
            if (resource.languageSelection) return resource.languageSelection;
            else if (resource.hasParent()) return this._getLanguageSelection(resource.getParent());
            else return null;
        }


        , setQueryLanguageSelection: function(languageSelection) {
            this.getRootResource().languageSelection = languageSelection;
            return this;
        }


        /*
         * checks if this extension should be used on the current model
         * methods and properties may be installed on the models prototype
         */
        , applyModelMethods: function(definition, classDefinition) {
                
            // the user may define in which language the fields
            // need to be saved
            classDefinition.setLocale = this.setLanguage;

            // stop here, the table has no localization
            if (!definition.isLocalizedTable) return;


            Object.keys(this._storage[definition.databaseName][definition.name]).forEach(function(columnName) {
                classDefinition[columnName] = {
                      get: function() {
                        return this._values[columnName];
                    }
                    , set: function(value) {
                        if (this._values[columnName] !== value) {
                            //this._changedValues.push(columnName);
                            this._values[columnName] = value;
                            //this._setChanged();
                        }
                    }
                    , enumerable: true
                };

                if (!classDefinition._serialize) classDefinition._serialize = []
                classDefinition._serialize.push(columnName);
                //classDefinition._columns[columnName] = {type: 'scalar'};
            }.bind(this));
        }


        /*
         * checks if this extension should be used on the current querybuilder
         * methods and properties may be installed on the models prototype
         */
        , applyQueryBuilderMethods: function(definition, classDefinition) {

            // the user has to define which languages he likes to load
            // on the current query
            classDefinition.setLocale = this.setQueryLanguageSelection;
        }


        /*
         * checks if this extension should be applied to the 
         * current model
         */
        , useOnModel: function(definition) {
            var   mappingDefinition
                , resultColumn;

            // say yes if this table maps to the language table
            if (Object.keys(definition.columns).some(function(columnName) {
                var column = definition.columns[columnName];

                return column && column.mapsTo && column.mapsTo.some(function(mapping){
                    if (mapping.name === this.languageTable) {
                        mappingDefinition = mapping;
                        resultColumn = column;
                        //log(definition);
                        return true;
                    }
                    else return false;
                }.bind(this));
            }.bind(this))) {
                // this model has a locale table
                var config = {
                      mappingName       : mappingDefinition.via.model.name
                    , referencingColumn : mappingDefinition.via.fk
                    , referencedColumn  : resultColumn.name
                };

                // we need to store which columns map to which table
                if (!this._storage[definition.databaseName]) this._storage[definition.databaseName] = {};
                if (!this._storage[definition.databaseName][definition.name]) this._storage[definition.databaseName][definition.name] = {};

                Object.keys(mappingDefinition.via.model.columns).forEach(function(col) {
                    var localColumn = mappingDefinition.via.model.columns[col];
                    if (!localColumn.isPrimary) {
                        this._storage[definition.databaseName][definition.name][localColumn.name] = config;
                    }
                }.bind(this));

                // mark as localized
                definition.isLocalizedTable = true;

                // tell to use this extension on this table
                return true;
            }
            else {
                // mark as NOT localized
                definition.isLocalizedTable = false;

                // apply the setlocale method anyway
                return true;
            }
        }
    });
}();
