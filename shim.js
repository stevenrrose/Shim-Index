/*
 *
 * Piece-related algorithms and functions.
 *
 */

/** Ratio between shim side and base. */
var shimRatio = 64;

/** Angle of shim tip (in radians). Chord is 2*sin(angle/2). */
var shimAngle = 2*Math.asin(0.5/shimRatio);

/** Size of negative space in base units. */
var negativeSpace = 6;

/**
 * Linear congruential generator x_n+1 = (a.x_n + c) mod m.
 *
 * Used to generate a non-repeating sequence of m=2x^y integers starting at 0.
 *
 *  @param v    Previous value.
 *  @param x    Number of shims per shim unit.
 *  @param y    Number of shim units/slots per piece.
 *
 *  @return serial number.
 */
function lcg(v, x, y) {
    // Number of desired permutations.
    var m = 2*Math.pow(x, y);
    
    // LCG will have a full period if and only if:
    // 1. c and m are relatively prime
    // 2. a-1 is divisible by all prime factors of m
    // 3. a-1 is a multiple of 4 if m is a multiple of 4
    //
    // As m=2x^Y, prime factors of m are 2 and x, if x is prime, or x's prime
    // factors otherwise.
    // m is multiple of 4 if and only if x is multiple of 2.
    
    var c = 982451653;        // Large prime. As x is much smaller, this guarantees #1
    var a = 2*x*122949823+1;  // This guarantees #2 and #3.
    return (a*v+c) % m;
}

/**
 * Generate a random shim permutation.
 *
 *  @param x    Number of shims per shim unit.
 *  @param y    Number of shim units/slots per piece.
 *
 *  @return serial number.
 */
function generatePermutation(index, seed, x, y) {
    // Generate pseudorandom value in [0, 2*max) by calling LCG with sequence
    // number XOR'd by random seed.
    var r = lcg(Math.abs(index^seed), x, y);
    
    // Sign.
    var sign;
    var max = Math.pow(x, y);
    if (r < max) {
        // Negative / downward.
        sign = "-";
    } else {
        // Positive / upward.
        sign = "+";
        r /= 2;
    }
    
    // Digits.
    var digits = "";
    for (var i = 0; i < y; i++) {
        digits += String.fromCharCode(65 + (r % x));
        r /= x;
    }
    
    return sign + digits;
}

/**
 * Rotate point *p* around center *c* by given *angle*.
 *
 *  @param c        Center of rotation.
 *  @param p        Point to rotate.
 *  @param angle    Rotation angle in radians.
 *
 *  @return Rotated point.
 */
function rotate(c, p, angle) {
    return {
        x: Math.cos(angle) * (p.x-c.x) - Math.sin(angle) * (p.y-c.y) + c.x,
        y: Math.sin(angle) * (p.x-c.x) + Math.cos(angle) * (p.y-c.y) + c.y
    };
}

/**
 * Project line passing trought *c* and *p* on horizontal line at *y*.
 *
 *  @param c, p     Points on line to project.
 *  @param y        Y-coordinate of line to project onto.
 *
 *  @return Projected point.
 */
function project(c, p, y) {
    return {
        x: c.x + (p.x-c.x) / (p.y-c.y) * (y-c.y),
        y: y
    };
}

/**
 * Compute a piece from its serial number.
 *
 *  @param sn   The piece serial number.
 *
 *  @return The piece object.
 */
function computePiece(sn, crop) {
    if (sn.length < 2 || (sn[0] != '+' && sn[0] != '-')) return;

    //
    // 1. Iterate over slots and build shim coordinates.
    //
    
    var slots = Array(); // Array of slots.
    var nbSlots = sn.length-1;
    var angleStep = 0; // Rotation steps, each of shimAngle radians.
    var upward = (sn[0]=='+'); // Whether first shim is pointing upward.
    for (var iSlot = 0; iSlot < nbSlots; iSlot++) {
        // Left base corner of first shim when angle = 0 (vertical).
        var p1_base = {x: 0, y: (upward ? shimRatio : 0)};

        var shims = Array();
        slots[iSlot] = {shims: shims, angleStep: angleStep, upward: upward};
        
        // Iterate over shims.
        var nbShims = sn.charCodeAt(iSlot+1)-64; /* A=65 */
        for (var iShim = 0; iShim < nbShims; iShim++) {
            var p0 = {x: 0, y: (upward ? 0 : shimRatio)};
            var p1 = rotate(p0, p1_base, angleStep * shimAngle);
            angleStep -= (upward ? 1 : -1);
            var p2 = rotate(p0, p1_base, angleStep * shimAngle);
            
            // Shim = array of points.
            shims[iShim] = [p0, p1, p2];
        }
        
        // Flip orientation of next slot.
        upward = !upward;
    }
    
    //
    // 2. Crop shims.
    //

    var height = shimRatio;
    if (crop) {
        // Compute piece height, i.e. minimal y-distance between shim tip and 
        // corners.
        for (var iSlot = 0; iSlot < slots.length; iSlot++) {
            var slot = slots[iSlot];
            for (var iShim = 0; iShim < slot.shims.length; iShim++) {
                var shim = slot.shims[iShim];
                height = Math.min(
                    height,
                    Math.abs(shim[1].y-shim[0].y),
                    Math.abs(shim[2].y-shim[0].y)
                );
            }
        }
        
        //  Align downward shims tip on bottom side.
        for (var iSlot = 0; iSlot < slots.length; iSlot++) {
            var slot = slots[iSlot];
            for (var iShim = 0; iShim < slot.shims.length; iShim++) {
                var shim = slot.shims[iShim];
                if (slot.upward) continue;
                for (i = 0; i < 3; i++) {
                    shim[i].y -= shimRatio-height;
                }
            }
        }
        
        // Crop slots by piece height.
        for (var iSlot = 0; iSlot < slots.length; iSlot++) {
            var slot = slots[iSlot];
            for (var iShim = 0; iShim < slot.shims.length; iShim++) {
                var shim = slot.shims[iShim];
                for (i = 1; i < 3; i++) {
                    shim[i] = project(
                        shim[0], shim[i], 
                        (slot.upward ? height : 0)
                    );
                }
            }
        }
    }
    
    //
    // 3. Build negative spaces according to alignment rules.
    //
    //  - Project previous slot's right side on next slot's tip side, then shift 
    //    horizontally by negative space. 
    //  - Align downward shims tip on bottom side.
    //
    for (var iSlot = 1; iSlot < slots.length; iSlot++) {
        var slot = slots[iSlot];
        var prevSlot = slots[iSlot-1];
        var prevShim = prevSlot.shims[prevSlot.shims.length-1];
        var prevTip = prevShim[0];
        var prevRight = prevShim[2];
        var shift =   project(
                        prevTip, prevRight, 
                        slot.upward ? 0 : height
                     ).x
                    + negativeSpace;
        
        for (var iShim = 0; iShim < slot.shims.length; iShim++) {
            var shim = slot.shims[iShim];
            for (i = 0; i < 3; i++) {
                shim[i].x += shift;
            }
        }
    }
    
    //
    // 4. Compute bounding box.
    //
    
    var x=0, y=0, x2=0, y2=0;
    for (var iSlot = 1; iSlot < slots.length; iSlot++) {
        var slot = slots[iSlot];
        for (var iShim = 0; iShim < slot.shims.length; iShim++) {
            var shim = slot.shims[iShim];
            for (i = 0; i < 3; i++) {
                x = Math.min(x, shim[i].x);
                y = Math.min(y, shim[i].y);
                x2 = Math.max(x2, shim[i].x);
                y2 = Math.max(y2, shim[i].y);
            }
        }
    }
    
    return {sn: sn, slots: slots, bbox: {x: x, y: y, x2: x2, y2: y2}};
}

/**
 * Output a piece as SVG.
 *
 *  @param piece        The piece data.
 *
 *  @return SVG XML data.
 */
function drawSVG(piece) {
    var res = "";
    for (var iSlot = 0; iSlot < piece.slots.length; iSlot++) {
        var slot = piece.slots[iSlot];
        for (var iShim = 0; iShim < slot.shims.length; iShim++) {
            var shim = slot.shims[iShim];
            res += "<polygon points='"
                +       shim[0].x + "," + shim[0].y
                + "," + shim[1].x + "," + shim[1].y
                + "," + shim[2].x + "," + shim[2].y
                + "' class='shim'/>";
        }
    }
    res += "<rect x='" + piece.bbox.x 
        + "' y='" + piece.bbox.y
        + "' width='" + (piece.bbox.x2-piece.bbox.x)
        + "' height='"+ (piece.bbox.y2-piece.bbox.y)
        + "' class='bbox'/>";
    return res;
}

/**
 * Draw a piece into a PDF document.
 *
 *  @param piece        The piece data.
 *  @param pdf          jsPDF document.
 */
function drawPDF(piece, pdf) {
    // Line width. Use same for shims and bbox.
    pdf.setLineWidth("0.05");
    
    for (var iSlot = 0; iSlot < piece.slots.length; iSlot++) {
        var slot = piece.slots[iSlot];
        for (var iShim = 0; iShim < slot.shims.length; iShim++) {
            var shim = slot.shims[iShim];
            pdf.triangle(
                shim[0].x*pdf.scale+pdf.offx, shim[0].y*pdf.scale+pdf.offy,
                shim[1].x*pdf.scale+pdf.offx, shim[1].y*pdf.scale+pdf.offy,
                shim[2].x*pdf.scale+pdf.offx, shim[2].y*pdf.scale+pdf.offy,
                'D'
            );
        }
    }
    pdf.rect(
        piece.bbox.x*pdf.scale+pdf.offx, piece.bbox.y*pdf.scale+pdf.offy, 
        (piece.bbox.x2-piece.bbox.x)*pdf.scale, (piece.bbox.y2-piece.bbox.y)*pdf.scale, 
        'D'
    );
}

/**
 * Generate a multi-page PDF from a set of pieces.
 *
 *  @param orient   Orientation ('portrait', 'landscape').
 *  @param format   Page format ('a3', 'a4','a5' ,'letter' ,'legal').
 *
 *  @return PDF data URI.
 */
function piecesToPDF(orient, format, pieces) {
    // Create jsPDF object.
    var pdf = new jsPDF(orient, 'mm', format);
    
    // Scale and margin.
    pdf.offx = 15; pdf.offy = 15; pdf.scale = 2; // @TODO add settings
    
    // Draw each piece.
    var first = true;
    for (var sn in pieces) {
        if (!first) {
            pdf.addPage();
        } else {
            first = false;
        }
        drawPDF(pieces[sn], pdf);
    }
    
    // Return as data URI.
    // return pdf.output('datauristring');
    pdf.output("save");//FRED
}


/*
 *
 * Interface functions.
 *
 */

/** Maximum integer value. */
var MAX_INT = Math.pow(2,53);

/** Handles. */
var x, y;

/** Maximum piece width. */
var maxWidth;

/** Number of generated pieces. */
var nbPieces;

/** Permutation seed. */
var seed;

/** Columns and rows to display. */
var columns, rows;

/** Column class for piece elements. */
var colClass;

/** Paging. */
var nbPages, nbPerPage;

/** Default selection state. */
var defaultSelected;

/** Piecewise selection toggle state. */
var pieceToggle;

/** Number of toggled pieces. We can't rely on pieceToggle.length because JS 
  * may switch between vector and object for sparse array storage. */
var nbToggle;
  
/**
 * Ensure that permutation is not too large. Else disable interface elements.
 */
 
function validatePermutationSize() {
    var x = parseInt($("#x").val());
    var y = parseInt($("#y").val());
    var nbPieces = 2*Math.pow(x,y);
    if (nbPieces > MAX_INT) {
        // Permutation too large.
        $("#generate").removeClass("btn-default").addClass("btn-danger").attr('disabled',true);
        $("#x, #y").parent().addClass("has-error bg-danger");
        $("#message").addClass("panel-body").html("<div class='alert alert-danger'><span class='glyphicon glyphicon-warning-sign'></span> Permutation size too large!</div>");
    } else {
        $("#generate").removeClass("btn-danger").addClass("btn-primary").removeAttr('disabled');
        $("#x, #y").parent().removeClass("has-error bg-danger");
        $("#message").removeClass("panel-body").empty();
    }
}

/**
 * Generate a new set of pieces.
 */

function generatePieces() {
    // Get all parameters.
    x = parseInt($("#x").val());
    y = parseInt($("#y").val());
    
    nbPieces = parseInt($("#nbPieces").val());
    if ($("#max")[0].checked) {
        // Use max number of pieces.
        nbPieces = 2*Math.pow(x,y);
    }
    
    maxWidth = Math.ceil(y/2)*x + negativeSpace*(y-1);


    if ($("#random")[0].checked) {
        // Generate random seed.
        seed = Math.floor(Math.random() * 0x7FFFFFFF);
        $("#seed").val(seed);
    }
    seed = parseInt($("#seed").val());
    
    // Set default selection state.
    defaultSelected = true;
    pieceToggle = Array();
    nbToggle = 0;
    updateCounters();
    
    // Adjust column layout.
    columns = parseInt($("#columns").val());
    switch (columns) {
        case 0:
            // Automatic, use 4-column responsive layout.
            columns = 4;
            colClass = "col-xs-12";
            if (nbPieces >= 2) {
                colClass += " col-sm-6";
            }
            if (nbPieces >= 3) {
                colClass += " col-md-4";
            }
            if (nbPieces >= 4) {
                colClass += " col-lg-3";
            }
            break;
            
        case 1:
            colClass = "col-xs-12";
            break;
            
        case 2:
            colClass = "col-xs-12 col-sm-6";
            break;
            
        case 3:
            colClass = "col-xs-12 col-sm-4";
            break;
            
        case 4:
            colClass = "col-xs-12 col-sm-3";
            break;
            
        case 6:
            colClass = "col-xs-12 col-sm-2";
            break;
    }
    rows = parseInt($("#rows").val());
    
    // Paging.
    nbPerPage = columns*rows;
    nbPages = Math.ceil(nbPieces/nbPerPage);

    // Display first page
    displayPieces(0);
}

/** 
 * Display pieces for a given page.
 *
 *  @param page     Page number (zero-indexed).
 */
function displayPieces(page) {
    // Sanity check.
    page = Math.max(0, Math.min(page, nbPages-1));
    
    // Display toolbar.
    $("#toolbar").removeClass("hidden");
    
    // Display pager.
    var $pager = $("#pager");
    $pager.empty();
    if (nbPages > 1) {
        var pager = "<ul class='pagination pagination-sm'>";
        pager += "<li" + (page==0?" class='disabled'":"") + "><a href='javascript:displayPieces(" + Math.max(0,page-1) + ")'>&laquo;</a></li>";
        for (var i = 0; i < nbPages; i++) {
            if (nbPages > 10) {
                // Limit buttons to 10, add ellipses for missing buttons.
                if (page < 5) {
                    if (i == 8) {
                        // Ellipsis at end.
                        pager += "<li class='disabled'><span>...</span></li>";
                        i = nbPages-2;
                        continue;
                    }
                } else if (page >= nbPages-5) {
                    if (i == 1) {
                        // Ellipsis at beginning.
                        pager += "<li class='disabled'><span>...</span></li>";
                        i = nbPages-9;
                        continue;
                    }
                } else {
                    if (i == 1) {
                        // Ellipsis at beginning.
                        pager += "<li class='disabled'><span>...</span></li>";
                        i = page-3;
                        continue;
                    } else if (i == page+3) {
                        // Ellipsis at end.
                        pager += "<li class='disabled'><span>...</span></li>";
                        i = nbPages-2;
                        continue;
                    }
                }
            }
            pager += "<li" + (i==page?" class='active'":"") + "><a href='javascript:displayPieces(" + i + ")'>" + (i+1) + "</a></li>";
        }
        pager += "<li" + (page==nbPages-1?" class='disabled'":"") + "><a href='javascript:displayPieces(" + Math.min(page+1,nbPages-1) + ")'>&raquo;</a></li>";
        pager += "</ul>";
        $pager.append(pager);
    }    
    
    // Clear existing pieces.
    var $pieces = $("#pieces");
    $pieces.empty();
    
    // Generate piece output elements.
    var begin = nbPerPage*page;
    var end = Math.min(begin+nbPerPage, nbPieces);
    for (var i = begin; i < end; i++) {
        // Selection state.
        var selected = defaultSelected;
        if (pieceToggle[i]) selected = !selected;
        
        var piece = "<div id='piece-" + i + "' class='form-inline piece " + colClass + "'>";
        piece += "<input id='piece-select-" + i + "' class='piece-select' data-piece='" + i + "' type='checkbox' onclick='togglePiece(" + i + ")' " + (selected?" checked":"") + "/> ";
        piece += "<label for='piece-select-" + i + "' class='thumbnail'>";
        piece += "<svg xmlns='http://www.w3.org/2000/svg' version='1.1'></svg><br/>";
        piece += "<div class='input-group input-group-sm'>";
        piece += "<input type='text' class='form-control sn' readonly placeholder='Piece S/N' value='" + generatePermutation(i, seed, x, y) + "' size='" + y + "'/>";
        piece += "<span class='input-group-btn'><button type='button' class='btn btn-default' onclick='downloadSVG($(this).parent().parent().find(\".sn\").val().trim())'><span class='glyphicon glyphicon-download'></span> SVG</button></span>"
        piece += "</div>";
        piece += "</label>";
        piece += "</div>";
        $pieces.append(piece);
    }
    
    // Display pieces.
    $pieces.find(".piece").each(function(index, element) {
        updatePiece(element);
    });
}

/**
 * Update existing piece when some parameter changes (e.g. cropping).
 */
function updatePieces() {
    $("#pieces .piece").each(function(index, element) {
        updatePiece(element);
    });
}

/**
 * Compute & output piece from its S/N.
 *
 *  @param element    The containing element.
 */
function updatePiece(element) {
    var sn = $(element).find(".sn").val().trim();
    
    // Generate piece.
    var cropped = $("#cropped")[0].checked;    
    var piece = computePiece(sn, cropped);
    
    // Output to SVG.
    var $svg = $(element).find("svg");
    $svg.html(drawSVG(piece));
    
    // Adjust viewbox so that all pieces are centered and use the same scale.
    // Don't use jQuery as it is case-insensitive.
    $svg[0].setAttribute('viewBox', 
        ((piece.bbox.x2-piece.bbox.x)-maxWidth)/2
        + " "
        + ((piece.bbox.y2-piece.bbox.y)-shimRatio)/2
        + " " + maxWidth + " " + shimRatio);
}

/**
 * Toggle select state of given piece.
 *
 *  @param piece    Piece number to toggle.
 */
function togglePiece(piece) {
    if (pieceToggle[piece]) {
        delete pieceToggle[piece];
        nbToggle--;
    } else {
        pieceToggle[piece] = true;
        nbToggle++;
    }
    updateCounters();
    
}

/**
 * Check/uncheck visible pieces.
 *
 *  @param  check   Whether to check or uncheck pieces.
 */
function checkVisible(check) {
    $(".piece-select").each(function(index, element) {
        if (element.checked^check) {
            $(element).click();
        }
    });
}

/**
 * Check/uncheck all pieces.
 *
 *  @param  check   Whether to check or uncheck pieces.
 */
function checkAll(check) {
    checkVisible(check);
    defaultSelected = check;
    nbToggle = 0;
    pieceToggle = Array();
    updateCounters();
}

/**
 * Update piece counters.
 */
function updateCounters() {
    $("#totalPieces").html(nbPieces);
    $("#selectedPieces").html(defaultSelected ? nbPieces - nbToggle : nbToggle);
}

/**
 * Download piece as SVG.
 *
 *  @param sn   The piece serial number.
 */
function downloadSVG(sn) {
    // Generate piece.
    var cropped = $("#cropped")[0].checked;    
    var piece = computePiece(sn, cropped);
    
    // Output to SVG.
    var svg = "<svg xmlns='http://www.w3.org/2000/svg' version='1.1'"
        +   " viewBox='" + piece.bbox.x + " " + piece.bbox.y 
        +   " " + (piece.bbox.x2-piece.bbox.x) + " " + (piece.bbox.y2-piece.bbox.y)
        +   "'>";
    svg += "<style>.shim,.bbox{fill: none;stroke:black;stroke-width:0.1;}</style>";
    svg += drawSVG(piece);
    svg += "</svg>"

    blob = new Blob([svg], {type: "image/svg+xml"});

    saveAs(blob, sn + ".svg");
} 

/**
 * Output pieces to PDF.
 */
function downloadPDF() {
    piecesToPDF(
        $("[name='orient']:checked").val(), 
        $("[name='format']:checked").val(),
        pieces
    );
}
