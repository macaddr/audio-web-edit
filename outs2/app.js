/**
 * Create a WaveSurfer instance.
 */
var wavesurfer = Object.create(WaveSurfer);

/**
 * Init & load.
 */
document.addEventListener('DOMContentLoaded', function() {
    // Init wavesurfer
    wavesurfer.init({
        container: '#waveform',
        height: 200,
        pixelRatio: 1,
        scrollParent: true,
        normalize: true,
        minimap: true,
        backend: 'MediaElement'

    });

    wavesurfer.load('./media/usc.mp3');

    /* Regions */
    wavesurfer.enableDragSelection({
        color: randomColor(0.1)
    });

    wavesurfer.on('ready', function() {
        var duration = wavesurfer.getDuration();
        console.log(duration);
        var dm=parseInt(duration / 60);
        var ds=parseInt(duration % 60);
        document.querySelector("#ttime").innerHTML="总时长  "+dm+":"+ds;
        if (localStorage.regions) {
            loadRegions(JSON.parse(localStorage.regions));
        } else {
            // loadRegions(
            //     extractRegions(
            //         wavesurfer.backend.getPeaks(512),
            //         wavesurfer.getDuration()
            //     )
            // );
            wavesurfer.util.ajax({
                responseType: 'json',
                url: 'annotations.json'
            }).on('success', function(data) {
                loadRegions(data);
                saveRegions();
            });
        }
    });

    // wavesurfer.on('region-click', function(region, e) {
    //     e.stopPropagation();
    //     // Play on click, loop on shift click
    //     e.shiftKey ? region.playLoop() : region.play();
    // });
    // wavesurfer.on('region-mouseenter', test);
    wavesurfer.on('region-created',createdinit);
    wavesurfer.on('region-click', editAnnotation);
    wavesurfer.on('region-mouseenter', enableZoomtool);
    wavesurfer.on('region-mouseleave', disableZoomtool);
    wavesurfer.on('region-updated', saveRegions);
    wavesurfer.on('region-removed', saveRegions);
    wavesurfer.on('region-in', showNote);

    wavesurfer.on('region-play', function(region) {
        region.once('out', function() {
            wavesurfer.play(region.start);
            wavesurfer.pause();
        });
    });


    /* Minimap plugin */
    wavesurfer.initMinimap({
        height: 30,
        waveColor: '#ddd',
        progressColor: '#444',
        cursorColor: '#999'

    });


    /* Timeline plugin */
    wavesurfer.on('ready', function() {
        var timeline = Object.create(WaveSurfer.Timeline);
        timeline.init({
            wavesurfer: wavesurfer,
            container: "#wave-timeline"
        });
    });


    /* Toggle play/pause buttons. */
    var playButton = document.querySelector('#play');
    var pauseButton = document.querySelector('#pause');
    wavesurfer.on('play', function() {
        playButton.style.display = 'none';
        pauseButton.style.display = '';
        console.log(wavesurfer.get);
    });
    wavesurfer.on('pause', function() {
        playButton.style.display = '';
        pauseButton.style.display = 'none';
    });
});


function createdinit(region){
    // 创建region后，修改起始位置位区块开始
    var regionStart = region.start;
    // var duration = wavesurfer.getDuration();

    // var progress = regionStart/duration;
    console.log(regionStart);
    // wavesurfer.seekAndCenter(progress);
    
}

function enableZoomtool(region) {
    console.log('enableZoomtool');
    var regionId = region.id;
    console.log(regionId);
    // var a =  document.querySelectorAll('[data-id="'+regionId+ '"]');
    // console.log(a.dataset);
    // 通过regId反查dom
    // 该dom下开启
}

function disableZoomtool(region) {
    console.log('disableZoomtool');
}




/**
 * Save annotations to localStorage.
 */
function saveRegions() {
    localStorage.regions = JSON.stringify(
        Object.keys(wavesurfer.regions.list).map(function(id) {
            var region = wavesurfer.regions.list[id];
            return {
                start: region.start,
                end: region.end,
                attributes: region.attributes,
                data: region.data
            };
        })
    );
}


/**
 * Load regions from localStorage.
 */
function loadRegions(regions) {
    regions.forEach(function(region) {
        region.color = randomColor(0.1);
        wavesurfer.addRegion(region);
    });
}


/**
 * Extract regions separated by silence.
 */
function extractRegions(peaks, duration) {
    // Silence params
    var minValue = 0.0015;
    var minSeconds = 0.25;

    var length = peaks.length;
    var coef = duration / length;
    var minLen = minSeconds / coef;

    // Gather silence indeces
    var silences = [];
    Array.prototype.forEach.call(peaks, function(val, index) {
        if (Math.abs(val) <= minValue) {
            silences.push(index);
        }
    });

    // Cluster silence values
    var clusters = [];
    silences.forEach(function(val, index) {
        if (clusters.length && val == silences[index - 1] + 1) {
            clusters[clusters.length - 1].push(val);
        } else {
            clusters.push([val]);
        }
    });

    // Filter silence clusters by minimum length
    var fClusters = clusters.filter(function(cluster) {
        return cluster.length >= minLen;
    });

    // Create regions on the edges of silences
    var regions = fClusters.map(function(cluster, index) {
        var next = fClusters[index + 1];
        return {
            start: cluster[cluster.length - 1],
            end: (next ? next[0] : length - 1)
        };
    });

    // Add an initial region if the audio doesn't start with silence
    var firstCluster = fClusters[0];
    if (firstCluster && firstCluster[0] != 0) {
        regions.unshift({
            start: 0,
            end: firstCluster[firstCluster.length - 1]
        });
    }

    // Filter regions by minimum length
    var fRegions = regions.filter(function(reg) {
        return reg.end - reg.start >= minLen;
    });

    // Return time-based regions
    return fRegions.map(function(reg) {
        return {
            start: Math.round(reg.start * coef * 10) / 10,
            end: Math.round(reg.end * coef * 10) / 10
        };
    });


}


/**
 * Random RGBA color.
 */
function randomColor(alpha) {
    return 'rgba(' + [~~(Math.random() * 255), ~~(Math.random() * 255), ~~(Math.random() * 255),
        alpha || 1
    ] + ')';

}


/**
 * Edit annotation for a region.
 */
function editAnnotation(region) {
    var form = document.forms.edit;
    form.style.display = "";
    form.elements.start.value = Math.round(region.start * 10) / 10,
        form.elements.end.value = Math.round(region.end * 10) / 10;
    form.elements.note.value = region.data.note || '';
    form.onsubmit = function(e) {
        e.preventDefault();
        region.update({
            start: form.elements.start.value,
            end: form.elements.end.value,
            data: {
                note: form.elements.note.value
            }
        });
        form.style.display = "none";
    };
    form.onreset = function() {
        form.style.display = "none";
        form.dataset.region = null;
    };
    form.dataset.region = region.id;
}


/**
 * Display annotation.
 */
function showNote(region) {
    if (!showNote.el) {
        showNote.el = document.querySelector('#subtitle');
    }
    showNote.el.textContent = region.data.note || '–';
}

/**
 * Bind controls.
 */
GLOBAL_ACTIONS['delete-region'] = function() {
    var form = document.forms.edit;
    var regionId = form.dataset.region;
    if (regionId) {
        wavesurfer.regions.list[regionId].remove();
        form.reset();
    }
};

GLOBAL_ACTIONS['export'] = function() {
    window.open('data:application/json;charset=utf-8,' +
        encodeURIComponent(localStorage.regions));
};