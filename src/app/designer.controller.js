var FileSaver = require('file-saver');

angular
.module('KrakenDesigner')
.controller('KrakenDesignerController', function ($scope, $rootScope, $location, DefaultConfig, Constants) {

    // Default initial values set in any configuration generation:
    $rootScope.service = DefaultConfig.service;
    $rootScope.constants = Constants;

    $rootScope.save = function () {
        if ('undefined' === typeof $rootScope.service.endpoints || $rootScope.service.endpoints.length < 1) {
            alert("At least you need to define an endpoint");
            return false;
        }

        $rootScope.fixCipherSuitesType('github.com/devopsfaith/krakend-jose/signer', false);
        $rootScope.fixCipherSuitesType('github.com/devopsfaith/krakend-jose/validator', false);

        var date = new Date().getTime();
        downloadDocument(date + "-krakend.json", angular.toJson($rootScope.service, true)); // Beautify
        $rootScope.saved_once = true;
    };

    $rootScope.loadFile = function () {
        try {
            var loaded_json = JSON.parse($scope.service_configuration);
            DefaultConfig.service = loaded_json;
            $rootScope.service = DefaultConfig.service;
            $rootScope.dropzone_loaded = true;
        } catch (e) {
            alert("Failed to parse the selected JSON file.\n\n" + e.message);
        }

        $rootScope.fixCipherSuitesType('github.com/devopsfaith/krakend-jose/validator', true);
        $rootScope.fixCipherSuitesType('github.com/devopsfaith/krakend-jose/signer', true);
        $rootScope.loadSDOptions();
    };

    // The krakend-jose cipher_suites need to be stored as integer but Angular treats multiselect as strings:
    $rootScope.fixCipherSuitesType = function(ns, convertToString) {
        if ( 'undefined' !== typeof $rootScope.service && 'undefined' !== typeof $rootScope.service.endpoints ) {
            for( var e=0; e<$rootScope.service.endpoints.length; e++) {
                if('undefined' !== typeof $rootScope.service.endpoints[e].extra_config &&
                 'undefined' !== typeof $rootScope.service.endpoints[e].extra_config[ns] &&
                 'undefined' !== typeof $rootScope.service.endpoints[e].extra_config[ns].cipher_suites ) {

                    for( var s=0; s<$rootScope.service.endpoints[e].extra_config[ns].cipher_suites.length; s++ ) {
                        if ( convertToString ) {
                            $rootScope.service.endpoints[e].extra_config[ns].cipher_suites[s] = '' + $rootScope.service.endpoints[e].extra_config[ns].cipher_suites[s];
                        } else {
                            // Convert to integer
                            $rootScope.service.endpoints[e].extra_config[ns].cipher_suites[s] = parseInt($rootScope.service.endpoints[e].extra_config[ns].cipher_suites[s]);
                        }
                    }
                }
            }
        }
    }

    // Load Service Discovery options
    $rootScope.loadSDOptions = function() {
        var sd_provider = 'static';
        if ( 'undefined' !== typeof $rootScope.service.endpoints ) {
            for( var e=0; e<$rootScope.service.endpoints.length; e++) {
                if ( 'undefined' !== typeof $rootScope.service.endpoints[e].backend ) {
                        sd_provider = 'static'; // When provider is not defined
                        for( var b=0; b<$rootScope.service.endpoints[e].backend.length; b++) {
                            if ( 'undefined' !== typeof $rootScope.service.endpoints[e].backend[b].sd ) {
                                sd_provider = $rootScope.service.endpoints[e].backend[b].sd;
                            }
                            if ( 'undefined' !== typeof $rootScope.service.endpoints[e].backend[b].host ) {
                             for( var h=0; h<$rootScope.service.endpoints[e].backend[b].host.length; h++) {
                                $rootScope.addHost($rootScope.service.endpoints[e].backend[b].host[h], sd_provider);
                            }
                        }
                    }
                }
            }
        }
    }

    $rootScope.hasMiddleware = function(namespace) {
        return !(
            'undefined' === typeof $rootScope.service.extra_config ||
            'undefined' === typeof $rootScope.service.extra_config[namespace]
            );
    }

    // Destroy middleware or create it with default data:
    $rootScope.toggleMiddleware = function(namespace) {
        if ($rootScope.hasMiddleware(namespace)) {
            delete $rootScope.service.extra_config[namespace]
        } else {
            if (undefined !== DefaultConfig.extra_config[namespace]) {
                $rootScope.service.extra_config[namespace] = DefaultConfig.extra_config[namespace];
            } else {
                $rootScope.service.extra_config[namespace] = {};
            }
        }
    }

    /**
     * Pushes the value of the given container to an array with the given name or object, only if it doesn't exist.
     * @param container_name_with_value
     * @param array
     * @returns {*}
     */
     $rootScope.addTermToArray = function (term, array) {

        if ('string' == typeof array) {
            array = eval(array);
        }

        if (typeof array === "undefined") {
            return false;
        }

        if (array.indexOf(term) !== -1) {
            return false;
        }

        array.push(term);
    };

    $rootScope.deleteIndexFromArray = function (index, array_qualified_name) {

        var array = eval(array_qualified_name);
        array.splice(index, 1);
    };

    $rootScope.addHost = function (host, sd_type) {

        if ('static' === sd_type && ! /^https?:\/\/.+/i.test(host)) {
            alert('Please include de protocol http in the URL');
            return false;
        }

        if (typeof $rootScope.sd_providers === "undefined") {
            $rootScope.sd_providers = {};
        }

        if (typeof $rootScope.sd_providers.hosts === "undefined") {
            $rootScope.sd_providers.hosts = [];
        }

        if (typeof $rootScope.sd_providers.providers === "undefined") {
            $rootScope.sd_providers.providers = [];
        }

        // Avoid duplicates:
        for (var i=0; i < $rootScope.sd_providers.hosts.length; i++) {
            if ( $rootScope.sd_providers.hosts[i].sd === sd_type &&
                $rootScope.sd_providers.hosts[i].host === host ) {
                return false;
        }
    }

    $rootScope.sd_providers.hosts.push({ "sd": sd_type, "host": host });
    $rootScope.addTermToArray(sd_type, $rootScope.sd_providers.providers);
};

$rootScope.deleteWhitelist = function (white, backend_index, endpoint_index) {
    $rootScope.service.endpoints[endpoint_index].backend[backend_index].whitelist.splice(white - 1, 1);
};

$rootScope.deleteBlacklist = function (black, backend_index, endpoint_index) {
    $rootScope.service.endpoints[endpoint_index].backend[backend_index].blacklist.splice(black - 1, 1);
};


$rootScope.addWhitelist = function (endpoint_index, backend_index) {

    var container_name_with_value = '#wl' + endpoint_index + backend_index;

        // Create object if it doesn't exist yet
        if ('undefined' === typeof $rootScope.service.endpoints[endpoint_index].backend[backend_index].whitelist) {
            $rootScope.service.endpoints[endpoint_index].backend[backend_index].whitelist = [];
        }

        $rootScope.addTermToArray(
            $(container_name_with_value).val(),
            $rootScope.service.endpoints[endpoint_index].backend[backend_index].whitelist
            );

    };


    $rootScope.addBlacklist = function (endpoint_index, backend_index) {

        var container_name_with_value = '#bl' + endpoint_index + backend_index;

        // Create object if it doesn't exist yet
        if ('undefined' === typeof $rootScope.service.endpoints[endpoint_index].backend[backend_index].blacklist) {
            $rootScope.service.endpoints[endpoint_index].backend[backend_index].blacklist = [];
        }

        $rootScope.addTermToArray(
            $(container_name_with_value).val(),
            $rootScope.service.endpoints[endpoint_index].backend[backend_index].blacklist
            );

    };

    $rootScope.addTransformation = function (endpoint_index, backend_index) {

        var target = $('#tr_target' + endpoint_index + backend_index).val();
        var origin = $('#tr_origin' + endpoint_index + backend_index).val();

        if (typeof $rootScope.service.endpoints[endpoint_index].backend[backend_index].mapping === "undefined") {
            $rootScope.service.endpoints[endpoint_index].backend[backend_index].mapping = {};
        }
        $rootScope.service.endpoints[endpoint_index].backend[backend_index].mapping[origin] = target;
    };

    $rootScope.deleteTransformation = function (origin, endpoint_index, backend_index) {
        delete $rootScope.service.endpoints[endpoint_index].backend[backend_index].mapping[origin];
    };

    $rootScope.addEndpoint = function () {

        if ( typeof $rootScope.sd_providers==="undefined" || typeof $rootScope.sd_providers.hosts === "undefined" || 1 < $rootScope.service.length) {
            alert("You need to add at least one host in the Service Configuration or Service Discovery panels.");
            return false;
        }

        if (typeof $rootScope.service.endpoints === "undefined") {
            $rootScope.service.endpoints = [];
        }
        $rootScope.service.endpoints.push({"endpoint": "/", "method": "GET"});
    };

    // Valid endpoints start with Slash and do not contain /__debug[/]
    $rootScope.isValidEndpoint = function (endpoint) {
        return !(/^[^\/]|\/__debug(\/.*)?$|\/favicon\.ico/i.test(endpoint));
    };

    $rootScope.isValidTimeUnit = function (time_with_unit) {

        return (
            'undefined' === typeof time_with_unit ||
            '' == time_with_unit ||
            /^\d+(ns|us|µs|ms|s|m|h)$/.test(time_with_unit)
            );
    };

    $rootScope.isInteger = function (integer) {
        return (
            'undefined' === typeof integer ||
            '' == integer ||
            /^\d+$/.test(integer)
            );
    };


    $rootScope.deleteEndpoint = function (endpoint_index, message) {
        if (confirm(message)) {
            $rootScope.service.endpoints.splice(endpoint_index, 1);
        }
    };

    $rootScope.updateNonGETBackends = function (endpoint_index, old_value, message) {

        var num_backends = ( 'undefined' === typeof $rootScope.service.endpoints[endpoint_index].backend ? 0 : $rootScope.service.endpoints[endpoint_index].backend.length );
        if (num_backends > 1) {
            if (old_value == 'GET' && confirm(message)) {
                $rootScope.service.endpoints[endpoint_index].backend.splice(1, 10000);
            } else {
                // Angular already updated the value, revert:
                $rootScope.service.endpoints[endpoint_index].method = 'GET';
            }
        }
    };

    /**
     * The setNoOpEncoding is called when the backend or the endpoint change their encoding.
     * It deletes all backend configuration and adds a backend with no-op.
     */
     $rootScope.setNoOpEncoding = function(endpoint_index, new_value, old_value, backend_index) {
        var message = "Selecting the No-Operation means that this endpoint will proxy all content to a *single backend* where no response manipulation is desired.\n\nThe noop option will be automatically set for both the backend and the endpoint. Existing backend settings for this endpoint will be discarded.\n\n Do you want to proceed?";
        var num_backends = ( 'undefined' === typeof $rootScope.service.endpoints[endpoint_index].backend ? 0 : $rootScope.service.endpoints[endpoint_index].backend.length );

        // Endpoint encoding and backend encoding must match to 'no-op':
        if (new_value == 'noop' && num_backends > 0) {

            if ( confirm(message) )
            {
                // Delete all backend queries and add just one, inheriting encoding:
                delete $rootScope.service.endpoints[endpoint_index].backend
                $rootScope.service.endpoints[endpoint_index].output_encoding = 'noop';
                $rootScope.addBackendQuery(endpoint_index);

                // Delete also static_response
                if ( 'undefined' !== typeof $rootScope.service.endpoints[endpoint_index].extra_config['github.com/devopsfaith/krakend/proxy'] ) {
                    delete $rootScope.service.endpoints[endpoint_index].extra_config['github.com/devopsfaith/krakend/proxy'];
                }

            } else { // Angular already updated the values, revert endpoint or backend:

                if ( null === backend_index )
                {
                    // Backend encoding
                    $rootScope.service.endpoints[endpoint_index].output_encoding = old_value;
                }
                else
                {
                    $rootScope.service.endpoints[endpoint_index].backend[backend_index].encoding = old_value;
                }
            }
        }
    }



    $rootScope.addBackendQuery = function (endpoint_index) {

        if (typeof $rootScope.service.endpoints[endpoint_index].backend === "undefined") {
            $rootScope.service.endpoints[endpoint_index].backend = [];
        }

        $rootScope.service.endpoints[endpoint_index].backend.push({
            "url_pattern": "/",
            "encoding": $rootScope.service.endpoints[endpoint_index].output_encoding
        });
    };

    $rootScope.toggleCaching = function($event, endpoint_index, backend_index) {
        if ( $event.target.checked ) {
            // Create the key that enables caching:
            $rootScope.service.endpoints[endpoint_index].backend[backend_index].extra_config['github.com/devopsfaith/krakend-httpcache'] = {};
        } else {
            delete $rootScope.service.endpoints[endpoint_index].backend[backend_index].extra_config['github.com/devopsfaith/krakend-httpcache'];
        }
    }

    $rootScope.deleteBackendQuery = function (endpoint_index, backend_index, message) {
        if (confirm(message)) {
            $rootScope.service.endpoints[endpoint_index].backend.splice(backend_index, 1);
        }
    };

    $rootScope.addDefaultStaticResponse = function (endpoint_index) {
        if ( 'undefined' === typeof $rootScope.service.endpoints[endpoint_index].extra_config ) {
            $rootScope.service.endpoints[endpoint_index].extra_config = {};
        }

        if (typeof $rootScope.service.endpoints[endpoint_index].extra_config['github.com/devopsfaith/krakend/proxy'] == "undefined") {

            $rootScope.service.endpoints[endpoint_index].extra_config['github.com/devopsfaith/krakend/proxy'] = {
                "static": {
                    "data" : {
                        "new_field_a": 123,
                        "new_field_b": ["arr1","arr2"],
                        "new_field_c": {"obj": "obj1"}
                    },
                    "strategy": "incomplete"
                }
            }
        }
    };

    $rootScope.deleteStaticResponse = function (endpoint_index) {
        delete $rootScope.service.endpoints[endpoint_index].extra_config['github.com/devopsfaith/krakend/proxy'];
    };

    $rootScope.addQuerystring = function (endpoint_index) {

        if (typeof $rootScope.service.endpoints[endpoint_index].querystring_params === "undefined") {
            $rootScope.service.endpoints[endpoint_index].querystring_params = [];
        }

        var term = document.getElementById('addQuerystring_' + endpoint_index).value;
        if (term.length > 0 && $rootScope.service.endpoints[endpoint_index].querystring_params.indexOf(term) === -1) {
            $rootScope.service.endpoints[endpoint_index].querystring_params.push(term);
        }
    };


    $rootScope.deleteQuerystring = function (query_index, endpoint_index) {
        $rootScope.service.endpoints[endpoint_index].querystring_params.splice(query_index, 1);
    };


    $rootScope.addHeaderPassing = function (endpoint_index, header) {
        if (typeof $rootScope.service.endpoints[endpoint_index].headers_to_pass === "undefined") {
            $rootScope.service.endpoints[endpoint_index].headers_to_pass = [];
        }

        $rootScope.addTermToArray( header, $rootScope.service.endpoints[endpoint_index].headers_to_pass );
    };

    $rootScope.deleteHeaderPassing = function (endpoint_index, header_index) {
        $rootScope.service.endpoints[endpoint_index].headers_to_pass.splice(header_index,1);
    };

});

function downloadDocument(name, content) {
    FileSaver.saveAs(new Blob([content], {type: "text/plain;charset=UTF-8"}), name, true);
}

// Avoid losing the configuration:
window.onbeforeunload = function () {
    return "Leaving now implies losing the changes configured if you didn't save. Are you sure?";
}
