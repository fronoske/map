let g_map;
let g_mvtSource;
let g_mvtSource2;
let g_mvtSource3;

const BUS_COLOR = "#4444ff80";

function getWeightByRoadClass(roadClass, zoom) {
    const metersPerPixel = 127444.1132 / 2 ** zoom;
    // const roadWidthMeter = 10 - roadClass; // roadClass は 1 ～ 9？
    // return roadWidthMeter / metersPerPixel;
    const widthMeter = (21 - roadClass) / 4; // 3m～5m に収まるように。1 → 5m、9 → 3m。
    return widthMeter / metersPerPixel;
}

function slope2color(slope) {
    if (slope > 0.15) return "#8e24aa";
    if (slope > 0.1) return "#e22b21";
    if (slope > 0.07) return "#f6602c";
    if (slope > 0.05) return "#fec759";
    if (slope > 0.03) return "#ffed93";
}

function calculateSlopeStyle(feature) {
    const currentZoom = g_map.getZoom();
    const roadClass = feature.properties.roadclass_c;
    const slope = feature.properties.slope;
    const slopeColor = slope2color(slope);
    if (roadClass && slope) {
        const lineWidth = getWeightByRoadClass(roadClass, currentZoom);
        return {
            strokeStyle: slopeColor,
            strokeOpacity: 0.9,
            lineWidth: lineWidth,
            arrowWidth: lineWidth * 2.4,
        };
    }
}

function initMap() {
    g_map = new google.maps.Map(document.getElementById("map"), {
        center: { lat: 35.5717522, lng: 139.5327092 },
        zoom: 14,
    });
    g_map.controls[google.maps.ControlPosition.TOP_RIGHT].push(document.getElementById("control-panel"));

    // 持ち家候補のアイコンを表示する
    addIcons();

    // if tiles have not been loaded, GetTile will trigger twice.
    google.maps.event.addListenerOnce(g_map, "tilesloaded", function () {
        initVectorTiles();
    });
}

function initVectorTiles() {
    const options = {
        url: "slope/14-{x}-{y}.pbf",
        debug: false,
        cache: true,
        sourceMaxZoom: 14,
        filter: (feature, _tileContext) => {
            return feature.type == 2;
        },
        style: (feature) => {
            const canvasStyle = calculateSlopeStyle(feature);
            // console.log(lineStyle);
            return canvasStyle;
        },
        customDraw: drawArrow,
    };
    g_mvtSource = new MVTSource(g_map, options);
    g_map.overlayMapTypes.insertAt(0, g_mvtSource);

    const options2 = {
        url: "bus_route/14/{x}/{y}.pbf",
        debug: false,
        cache: true,
        sourceMaxZoom: 14,
        style: (feature) => {
            return {
                strokeStyle: BUS_COLOR,
                lineWidth: g_map.getZoom() / 8,
            };
        },
    };
    g_mvtSource2 = new MVTSource(g_map, options2);
    g_mvtSource2.setVisibleLayers([]);
    g_map.overlayMapTypes.insertAt(1, g_mvtSource2);

    const options3 = {
        url: "bus_stop/14/{x}/{y}.pbf",
        debug: false,
        cache: true,
        sourceMaxZoom: 14,
        style: (feature) => {
            return {
                strokeStyle: BUS_COLOR,
                fillStyle: BUS_COLOR,
                radius: g_map.getZoom() / 8 + 3,
            };
        },
    };
    g_mvtSource3 = new MVTSource(g_map, options3);
    g_mvtSource3.setVisibleLayers([]);
    g_map.overlayMapTypes.insertAt(2, g_mvtSource3);

    const checkboxes = document.getElementsByName("cb-layers");
    for (const cb of checkboxes) {
        cb.addEventListener("change", function () {
            switch (cb.value) {
                case "slope_line":
                    console.log("cb-slope changed");
                    g_mvtSource.setVisibleLayers(cb.checked ? ["slope_line"] : []);
                    break;
                case "bus":
                    console.log("cb-bus changed");
                    g_mvtSource2.setVisibleLayers(cb.checked ? ["bus_route"] : []);
                    g_mvtSource3.setVisibleLayers(cb.checked ? ["bus_stop"] : []);
                    break;
                case "place":
                    console.log("cb-place changed");
                    break;
            }
        });
    }
}

function drawArrow(tileContext, tile, style, mVTFeature) {
    const context2d = mVTFeature.getContext2d(tileContext.canvas, style);
    const coordinates = tile.vectorTileFeature.coordinates[0];

    // 矢印の▲の準備
    const lastPoint = mVTFeature.getPoint(coordinates.at(-1), tileContext, tile.divisor); // 終点
    const prevPoint = mVTFeature.getPoint(coordinates.at(-2), tileContext, tile.divisor); // 終点の一つ手前の点
    const width = style.arrowWidth; // ▲の高さは幅と同じとする
    const angle = Math.atan2(lastPoint.y - prevPoint.y, lastPoint.x - prevPoint.x); // 最後の線分の角度
    const footPoint = Vertice(width, angle, lastPoint); // ▲の底辺の中央

    // 線分を描画
    context2d.globalAlpha = style.strokeOpacity;
    context2d.beginPath();
    for (let i = 0; i < coordinates.length; i++) {
        const point = mVTFeature.getPoint(coordinates[i], tileContext, tile.divisor);
        if (i === 0) {
            context2d.moveTo(point.x, point.y);
        } else if (i == coordinates.length - 1) {
            // ▲の底辺の中央まで線分を描画する
            context2d.lineTo(footPoint.x, footPoint.y);
        } else {
            context2d.lineTo(point.x, point.y);
        }
    }
    context2d.stroke();

    // ▲を描画
    context2d.lineWidth = 1;
    context2d.fillStyle = style.strokeStyle;
    // 底辺の両端
    const point2 = Vertice(width * 1.2, angle + Math.PI / 6, lastPoint);
    const point3 = Vertice(width * 1.2, angle - Math.PI / 6, lastPoint);

    context2d.beginPath();
    context2d.moveTo(lastPoint.x, lastPoint.y);
    context2d.lineTo(point2.x, point2.y);
    context2d.lineTo(point3.x, point3.y);
    context2d.closePath();
    context2d.fill();
    context2d.stroke();
}

function Vertice(radius, angle, point) {
    return {
        x: point.x - radius * Math.cos(angle),
        y: point.y - radius * Math.sin(angle),
    };
}

function addIcons() {
    const image = { url: "house.png", size: new google.maps.Size(32, 32) };
    /*
    const myLatLngArray = [
        { lat: 35.553, lng: 139.533 },
        { lat: 35.5808976, lng: 139.55386447 },
    ];
*/
    fetch("places.json")
        .then((res) => res.json())
        .then((places) => {
            const coords = places
                .map((place) => {
                    const match = place.match(/@?(35\.\d+),\s*(139\.\d+)[ ,]*(.+)/);
                    return match ? { lat: parseFloat(match[1]), lng: parseFloat(match[2]), title: match[3] } : null;
                })
                .filter(Boolean);
            console.log(coords);
            for (const latLngTitle of coords) {
                const {title, ...latLng} = latLngTitle;
                const marker = new google.maps.Marker({
                    position: latLng,
                    icon: "house.png",
                    size: new google.maps.Size(32, 32),
                    title: title ?? JSON.stringify(latLngTitle),
                });
                marker.setMap(g_map);
            }
        });
}
