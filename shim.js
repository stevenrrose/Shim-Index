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
 * Generate a random shim permutation.
 *
 *  @param x    Number of shims per shim unit.
 *  @param y    Number of shim units/slots per piece.
 *
 *  @return serial number.
 */
function generatePermutation(x, y) {
    var max = Math.pow(x, y);
    
    // Generate random value in [0, 2*max).
    // @TODO use non-repeating pseudo-random generator?
    var r = Math.floor(Math.random(i) * 2 * max);
    
    // Sign.
    var sign;
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
 * Draw a piece as SVG.
 *
 *  @param piece        The piece data.
 *  @param element      SVG DOM element for output (or CSS selector).
 */
function drawSVG(piece, element) {
    var svg = Snap(element);
    svg.clear();
    for (var iSlot = 0; iSlot < piece.slots.length; iSlot++) {
        var slot = piece.slots[iSlot];
        for (var iShim = 0; iShim < slot.shims.length; iShim++) {
            var shim = slot.shims[iShim];
            svg.polygon(
                shim[0].x, shim[0].y,
                shim[1].x, shim[1].y,
                shim[2].x, shim[2].y
            ).attr('class', "shim");
        }
    }
    svg.rect(
        piece.bbox.x, piece.bbox.y, 
        piece.bbox.x2-piece.bbox.x, piece.bbox.y2-piece.bbox.y
    ).attr('class', "bbox");
    
    svg.attr('viewBox', svg.getBBox().vb);
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

/** Associative array mapping piece ids (not S/N) to piece objects. */
var pieces;

/**
  * Generate a new set of pieces.
  */
function generatePieces() {
    // Clear existing pieces.
    pieces = new Object();
    var $pieces = $("#pieces");
    $pieces.empty();
    
    var nb = $("#nb").val();
    
    // Adjust column layout.
    var col;
    if (nb == 1) {
        col = "col-xs-12";
    } else if (nb == 2) {
        col = "col-xs-12 col-sm-6";
    } else if (nb == 3) {
        col = "col-xs-12 col-sm-6 col-md-4";
    } else {
        col = "col-xs-12 col-sm-6 col-md-4";
    }
    
    // Generate piece output elements.
    for (var i = 1; i <= nb; i++) {
        var piece = "<div id='piece" + i + "' class='piece " + col + "' _data-toggle='buttons'>";
        piece += "<input id='piece" + i + "-select' type='checkbox' checked/> ";
        piece += "<label for='piece" + i + "-select' class='thumbnail' style='text-align: center'>";
        piece += "<svg></svg><br/>";
        piece += "<input class='sn' type='text' placeholder='Piece S/N' onkeyup='updatePiece(this.parentElement)' onchange='updatePiece(this.parentElement)'>";
        piece += "</label>";
        piece += "</div>";
        $pieces.append(piece);
    }
    
    // Generate permutations.
    var x = $("#x").val(); 
    var y = $("#y").val();
    $pieces.find(".piece").each(function(index, element) {
        $(element).find(".sn").val(generatePermutation(x, y));
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
    pieces[element.id] = piece;
    
    // Output to SVG.
    var svg = $(element).find("svg")[0];
    drawSVG(piece, svg);
}

/**
 * Print existing pieces.
 */
function printPieces() {
    // Output pieces as PDF to iframe.
    $("#pdf").attr('src', piecesToPDF(
        $("[name='orient']:checked").val(), 
        $("[name='format']:checked").val(),
        pieces
    ));
}
