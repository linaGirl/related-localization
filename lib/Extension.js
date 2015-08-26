!function() {
    'use strict';


    var   Class             = require('ee-class')
        , log               = require('ee-log')
        , type              = require('ee-types')
        , async             = require('ee-async')
        , Promise           = (Promise || require('es6-promise').Promise)
        , argv              = require('ee-argv')
        , RelatedExtension  = require('related-extension');


    var thisContext;


    module.exports = new Class({
        inherits: RelatedExtension

        , languageTable: 'language'
        , codeField: 'code'


        , _name: 'localized'


        , init: function init(options) {
            init.super.call(this);

            // store this context so we'll have acces in some
            // methods attached to the model
            thisContext = this;

            // storage
            this._storage = {};

            // the user may define the name of the language table
            if (options && options.languageTable)   this.languageTable  = options.languageTable;
            if (options && options.codeField)       this.codeField      = options.codeField;
            if (options && options.blacklist)       this.blacklist      = options.blacklist;
        }





        /**
         * gets called after a model is saved
         *
         * @param <object> model
         * @param <object> transaction
         * @param <function> callback
         */
        , onAfterSave: function(model, transaction, callback) {
            var   databaseName = model._getDatabase().getDatabaseName()
                , tableName = model.getEntityName()
                , records = {}
                , changedValues = [];

            // stop here if the language for the model wasn't set!
            if (!model._language) return callback();


            if (!model.getDefinition().isLocalizedTable) return callback();


            // is there any data set
            if (!type.object(model._localizedValues)) return callback();


            // check if the mode._serialize object contains properties
            // that are managed by us
            Object.keys(model._localizedValues).forEach(function(propertyName) {
                var id, config;

                if (this._storage[databaseName][tableName][propertyName]) {
                    // hit, we need to load the local records in order to be able to compare
                    // them to the new values. if the localized values are all empty we're
                    // going to delete the entire record. else its saved. if it
                    // doesn't exist we have to create them

                    // cache the config
                    config = this._storage[databaseName][tableName][propertyName];

                    // dcollect the definition of all changes
                    if (!records[databaseName]) records[databaseName] = {};
                    if (!records[databaseName][config.mappingName]) records[databaseName][config.mappingName] = {config: config, values: {}};
                    records[databaseName][config.mappingName].values[propertyName] = model._localizedValues[propertyName];
                }
            }.bind(this));


            // load records
            Promise.all(Object.keys(records).map(function(dbName) {
                return Promise.all(Object.keys(records[dbName]).map(function(table) {
                    var   mappingFilter = {}
                        , languageFilter = {}
                        , config = records[dbName][table].config
                        , values = records[dbName][table].values;


                    mappingFilter[config.referencingColumn] = model[config.referencedColumn];
                    languageFilter[this.codeField] = model._language;


                    // get record
                    return this.orm[dbName][table](mappingFilter).get(this.languageTable, languageFilter).findOne(transaction).then(function(mappingRecord) {
                        var hasValues, langFilter;


                        if (!mappingRecord) {
                            langFilter = {};
                            langFilter[this.codeField] = model._language;

                            mappingRecord = new this.orm[dbName][table]();
                            mappingRecord[config.referencingColumn] = model[config.referencedColumn];
                            mappingRecord[this.languageTable] = this.orm[dbName][this.languageTable](langFilter);
                        }

                        Object.keys(values).forEach(function(prop) {
                            mappingRecord[prop] = values[prop];
                        }.bind(this));


                        // check if there is anythin left on the record
                        hasValues = Object.keys(mappingRecord.toJSON()).some(function(propName) {
                            return (mappingRecord[propName] !== null && mappingRecord[propName] !== undefined && config.primaryKeys.indexOf(propName) === -1);
                        }.bind(this));

                        records[dbName][table].data = mappingRecord;

                        // delete if there are no values execpt the pks
                        if (hasValues) return mappingRecord.save(transaction);
                        else {
                            if (mappingRecord.isFromDatabase()) return mappingRecord.delete(transaction);
                            else return Promise.resolve();
                        }
                    }.bind(this));
                }.bind(this)));
            }.bind(this))).then(function() {

                // set values from mapping
                Object.keys(records).forEach(function(dbName) {
                    Object.keys(records[dbName]).forEach(function(tableName) {
                        var item = records[dbName][tableName];

                        Object.keys(item.data.toJSON()).forEach(function(propertyName) {
                            if (item.config.primaryKeys.indexOf(propertyName) === -1 && type.string(item.data[propertyName])) {
                                model[propertyName] = item.data[propertyName];
                            }
                        }.bind(this));
                    }.bind(this));
                }.bind(this));

                // deon
                callback();
            }).catch(callback);
        }





        /*
         * we have to add our locale queries (sub selects)
         */
        , onBeforePrepareSubqueries: function(resource) {
            var   selected = resource.getQuery().select
                , subSelected = {};

            if (!resource.getDefinition().isLocalizedTable) return;
            if (!resource.getRootResoure().languageSelection) return;

            // we need to check if we nede to get the language data
            selected.some(function(selection) {
                if (this._storage[resource.databaseName] && this._storage[resource.databaseName][resource.name]) {
                    if (this._storage[resource.databaseName][resource.name][selection]) {
                        // specific field was selected
                        this._addSubSelect(selection, resource);
                        subSelected[selection] = true;
                    }
                }
            }.bind(this));


            // check if everything must be selected
            if (selected.selectAll) {
                Object.keys(this._storage[resource.databaseName][resource.name]).forEach(function(columnName) {
                    if (!subSelected[columnName]) {
                        this._addSubSelect(columnName, resource);
                        subSelected[columnName] = true;
                    }
                }.bind(this));
            }


            // remove all fields from the select of the original query
            // that belong to us
            for (var i = 0; i < selected.length; i++) {

                // check if this is a locale or not
                if (subSelected[selected[i]]) {

                    // we make use of this column, remove it from the
                    // original selection
                    selected.splice(i--, 1);
                }
            }
        }




        /**
         * called by the orm
         */
        , onBeforePrepare: function(resource) {
            // include all subqueries
            if (resource.hasChildren()) resource.getChildren().forEach(this.onBeforePrepare.bind(this));

            if (!resource.getDefinition().isLocalizedTable) return;
            if (!resource.getRootResoure().languageSelection) return;

            // prepare selected items
            thisContext.onBeforePrepareSubqueries(resource);

            // prepare filters
            thisContext.prepareFilters(resource);

            // ORDER STATEMENT
            thisContext.prepareOrder(resource);
        }





        /**
         * prepare the order statement
         *
         */
        , prepareOrder: function(resource, definition) {
            var   localEntity = this._storage[resource.databaseName][resource.name]
                , orderStatements
                , groupAdded = false;

            if (resource.query.order && resource.query.order.length) {
                orderStatements = resource.query.order;

                orderStatements.forEach(function(order) {
                    if (order.entity = resource.name) {
                        if (this._storage[resource.databaseName][resource.name][order.property]) {
                            var name = resource.queryBuilder.join(this._storage[resource.databaseName][resource.name][order.property].mappingName, true).getresource().getAliasName();
                            order.entity = name;

                            this._addGroupBy(order.entity, [order.property], resource);
                            groupAdded = true;
                        }
                    }
                }.bind(this));
            }

            // make sure to also group by the primaries
            if (groupAdded) {
                this._addGroupBy(resource.query.from, resource.getDefinition().primaryKeys, resource);
            }
        }





        /**
         * check if th euser tried to filter a localized field, move the filter to that entity
         */
        , prepareFilters: function(resource) {
            var   localEntity = this._storage[resource.databaseName][resource.name]
                , filter;

            if (resource.query.filter) {
                if (this._processFilter(resource.query.filter, '', resource.name, localEntity, Object.keys(this._storage[resource.databaseName][resource.name]), resource)) {
                    // we need to add a group by statement

                    this._addGroupBy(resource.query.from, resource.getDefinition().primaryKeys, resource);
                }
            }
        }




        /**
         * add group statement for a specific item
         */
        , _addGroupBy: function(entity, columns, resource) {
            var map = {};

            resource.query.group.forEach(function(grouping) {
                map[grouping.table+grouping.column] = true;
            });

            columns.forEach(function(column) {
                if (!map[entity+column]) {
                    resource.query.group.push({
                          table     : entity
                        , column    : column
                    });
                }
            });
        }



        /**
         * a littlebit of a crzy method to make the filters work with the language tables
         */
        , _processFilter: function(node, parentPropertyName, sourceTableName, localEntity, targetedProperties, resource) {
            var filterWasMoved = false;

            if (type.array(node)) {
                node.forEach(function(subNode) {
                    filterWasMoved = this._processFilter(subNode, parentPropertyName, sourceTableName, localEntity, targetedProperties, resource) || filterWasMoved;
                }.bind(this));
            }
            else if (type.object(node)) {
                Object.keys(node).forEach(function(propertyName) {
                    var mappingName;

                    if (type.object(node[propertyName]) || type.array(node[propertyName])) {
                        filterWasMoved = this._processFilter(node[propertyName], (propertyName === '_' ? parentPropertyName : propertyName), sourceTableName, localEntity, targetedProperties, resource) || filterWasMoved;
                    }
                    else {

                        // is this a field we're targeting?
                        if (parentPropertyName === sourceTableName && targetedProperties.indexOf(propertyName) >= 0) {
                            // ok, structure, table & properties match

                            // get the alias name, force the loceale tble to be joined
                            mappingName = resource.queryBuilder.join(localEntity[propertyName].mappingName, true).getresource().getAliasName();

                            node[mappingName] = {};
                            node[mappingName][propertyName] = node[propertyName];

                            // we need to group the original entity
                            filterWasMoved = true;

                            delete node[propertyName];
                        }
                    }
                }.bind(this));
            }

            return filterWasMoved;
        }




        , _addSubSelect: function(fieldName, resource) {
            if (!resource.getDefinition().isLocalizedTable) return;

            var   definition        = this._storage[resource.databaseName][resource.name][fieldName]
                , mappingName       = definition.mappingName
                , referencingColumn = definition.referencingColumn
                , referencedColumn  = definition.referencedColumn
                , languageSelection = this._getLanguageSelection(resource)
                , languageTable     = resource.name === this.languageTable && this._languageTableAliasName ? this._languageTableAliasName : this.languageTable
                , mappingFilter
                , filter;


            if (languageSelection && (!resource._localizedSelection || !resource._localizedSelection[fieldName])) {
                if (!resource._localizedSelection) resource._localizedSelection = {};
                resource._localizedSelection[fieldName] = true;

                filter = {};
                filter[this.codeField] = this.ORM .in(languageSelection);

                mappingFilter = {};
                mappingFilter[referencingColumn] = this.ORM .reference(resource.name, referencedColumn);
                mappingFilter[fieldName] = this.ORM .notNull();

                // we need to catch errors since the subquery may fail if the
                // user has tables that are lcoalized but not proper linked via the api
                try {
                    resource.selectColumn({
                          query: this.orm[resource.databaseName][mappingName]([fieldName], mappingFilter).limit(1).get(languageTable, filter).orderRoot(this.codeField, false, languageSelection)
                        , alias: fieldName
                    });
                }
                catch (e) {
                    if (argv.has('dev-orm') || argv.has('debug-sql')) log.warn('The locale extension failed to load the property «'+languageTable+'» on the property «'+mappingName+'»!');
                }
            }
        }


        , _getLanguageSelection: function(resource) {
            if (resource.languageSelection) return resource.languageSelection;
            else if (resource.hasParent()) return this._getLanguageSelection(resource.getParent());
            else return null;
        }


        , setQueryLanguageSelection: function(languageSelection) {
            this.getrootResource().languageSelection = languageSelection;
            return this;
        }


        /**
         * set the language on the model
         */
        , setLanguage: function(language) {
            if (!type.string(language) || language.length !== 2) throw('Cannot set language on «'+this.getEntityName()+'», expected 2 character language code. got «'+language+'»!');
            else this._language = language;

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
                        return this._localizedValues && this._localizedValues[columnName] ? this._localizedValues[columnName] : undefined;
                    }
                    , set: function(value) {
                        if (!this._localizedValues) this._localizedValues = {};

                        if (this._localizedValues[columnName] !== value) {
                            this._localizedValues[columnName] = value;
                            this._setChanged();
                        }
                    }
                    , enumerable: true
                };

                if (!classDefinition._serialize) classDefinition._serialize = [];

                classDefinition._serialize.push(columnName);
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

                return column && column.mapsTo && column.mapsTo.some(function(mapping) {
                    if (mapping.name === this.languageTable) {
                        mappingDefinition = mapping;
                        resultColumn = column;
                        //log(definition);
                        return true;
                    }
                    else return false;
                }.bind(this));
            }.bind(this))) {

                // need this for localized language tables (nope, thats not true... probably)
                //if (mappingDefinition.name === this.languageTable && mappingDefinition.aliasName) this._languageTableAliasName = mappingDefinition.aliasName;

                // this model has a locale table
                var config = {
                      mappingName       : mappingDefinition.via.model.name
                    , primaryKeys       : mappingDefinition.via.model.primaryKeys
                    , referencingColumn : (!this.blacklist || this.blacklist.indexOf(mappingDefinition.via.fk) === -1) ? mappingDefinition.via.fk : mappingDefinition.via.otherFk
                    , referencedColumn  : resultColumn.name
                };

                // we need to store which columns map to which table
                if (!this._storage[definition.databaseName]) this._storage[definition.databaseName] = {};
                if (!this._storage[definition.databaseName][definition.name]) this._storage[definition.databaseName][definition.name] = {};

                Object.keys(mappingDefinition.via.model.columns).forEach(function(col) {
                    var localColumn = mappingDefinition.via.model.columns[col];
                    if (!localColumn.isPrimary && localColumn.name !== this.codeField) {
                        // dont overwrite columns in the local model
                        if (!definition.columns[localColumn.name]) {
                            this._storage[definition.databaseName][definition.name][localColumn.name] = config;
                        }
                        else {
                            if (argv.has('dev-orm') || argv.has('debug-sql')) log.warn('The locale extension cannot use the %s column on the %s table because the %s table has a column with the same name!', localColumn.name, mappingDefinition.via.model.name, definition.name);
                        }
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
